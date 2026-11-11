const REVERB_SECONDS = 2.6;

function noiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  // A fixed generator, so a rendered soundtrack is the same every time.
  let state = 22222;
  for (let i = 0; i < data.length; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    data[i] = state / 2147483648 - 1;
  }
  return buffer;
}

function roomImpulse(ctx) {
  const length = Math.floor(ctx.sampleRate * REVERB_SECONDS);
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
  const noise = noiseBuffer(ctx, REVERB_SECONDS * 2).getChannelData(0);
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    let low = 0;
    for (let i = 0; i < length; i++) {
      const t = i / length;
      // The tail darkens as it decays, as a real room's does.
      low += (noise[i + channel * length] - low) * (0.55 - 0.4 * t);
      data[i] = low * (1 - t) ** 3;
    }
  }
  return impulse;
}

/**
 * Builds the page's instruments on an audio context. Works on a live AudioContext and on an
 * OfflineAudioContext alike.
 *
 * Voices and their parameters (freq in Hz, vel 0..1, dur in seconds):
 *   tick   {freq, vel}             a short blip, for counting
 *   pluck  {freq, vel, dur, echo}  a soft plucked string; echo 0..1 feeds a tempo delay
 *   bell   {freq, vel, dur}        a struck bell
 *   pad    {freqs, vel, dur}       a slow chord
 *   bass   {freq, vel, dur}
 *   whoosh {vel, dur}              a breath of air
 *   swish  {level}                 sets the level, 0..1, of a continuous bed of rushing air
 *
 * @param {BaseAudioContext} ctx
 * @returns {{play(voice: string, params: object, when: number): void}} when is a context time
 */
export function createSynth(ctx) {
  const master = ctx.createGain();
  master.gain.value = 0.85;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -16;
  limiter.ratio.value = 5;
  limiter.attack.value = 0.004;
  limiter.release.value = 0.2;
  master.connect(limiter).connect(ctx.destination);

  const room = ctx.createConvolver();
  room.buffer = roomImpulse(ctx);
  const roomLevel = ctx.createGain();
  roomLevel.gain.value = 0.5;
  room.connect(roomLevel).connect(master);

  const echo = ctx.createDelay(1);
  echo.delayTime.value = 0.3;
  const echoTone = ctx.createBiquadFilter();
  echoTone.type = 'lowpass';
  echoTone.frequency.value = 2200;
  const echoFeedback = ctx.createGain();
  echoFeedback.gain.value = 0.34;
  echo.connect(echoTone).connect(echoFeedback).connect(echo);
  echoTone.connect(master);
  echoTone.connect(room);

  const noise = noiseBuffer(ctx, 2);
  let bed = null;

  const oscillator = (type, freq, when, stop) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    osc.start(when);
    osc.stop(stop);
    return osc;
  };
  /** A gain that rises to `peak` in `attack` seconds and dies away by `end`. */
  const envelope = (when, peak, attack, end) => {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), when + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    return gain;
  };
  const send = (node, dry, wet) => {
    const d = ctx.createGain();
    d.gain.value = dry;
    node.connect(d).connect(master);
    const w = ctx.createGain();
    w.gain.value = wet;
    node.connect(w).connect(room);
  };

  const voices = {
    tick({ freq = 1400, vel = 0.4 }, when) {
      const out = envelope(when, vel * 0.8, 0.002, when + 0.07);
      oscillator('sine', freq, when, when + 0.09).connect(out);
      send(out, 1, 0.25);
    },
    pluck({ freq, vel = 0.5, dur = 0.9, echo: echoSend = 0 }, when) {
      const end = when + dur;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.Q.value = 0.9;
      tone.frequency.setValueAtTime(Math.min(freq * 5 + 900, 8000), when);
      tone.frequency.exponentialRampToValueAtTime(freq * 1.3 + 150, when + dur * 0.55);
      const body = ctx.createGain();
      body.gain.value = 0.7;
      oscillator('triangle', freq, when, end + 0.05).connect(body).connect(tone);
      const edge = ctx.createGain();
      edge.gain.value = 0.2;
      oscillator('sawtooth', freq * 1.003, when, end + 0.05).connect(edge).connect(tone);
      const out = envelope(when, vel * 0.42, 0.004, end);
      tone.connect(out);
      send(out, 1, 0.35);
      if (echoSend > 0) {
        const e = ctx.createGain();
        e.gain.value = echoSend;
        out.connect(e).connect(echo);
      }
    },
    bell({ freq, vel = 0.4, dur = 1.8 }, when) {
      const end = when + dur;
      const carrier = oscillator('sine', freq, when, end + 0.05);
      const index = ctx.createGain();
      index.gain.setValueAtTime(freq * 1.6, when);
      index.gain.exponentialRampToValueAtTime(freq * 0.05, when + dur * 0.5);
      oscillator('sine', freq * 2.76, when, end + 0.05).connect(index).connect(carrier.frequency);
      const out = envelope(when, vel * 0.3, 0.003, end);
      carrier.connect(out);
      send(out, 1, 0.6);
    },
    pad({ freqs, vel = 0.3, dur = 2 }, when) {
      const end = when + dur + 1.1;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 1000;
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, when);
      out.gain.linearRampToValueAtTime(vel * 0.11, when + 0.45);
      out.gain.setValueAtTime(vel * 0.11, when + dur);
      out.gain.linearRampToValueAtTime(0.0001, end);
      for (const freq of freqs) {
        for (const cents of [-7, 7]) {
          const osc = oscillator('sawtooth', freq, when, end + 0.05);
          osc.detune.value = cents;
          osc.connect(tone);
        }
      }
      tone.connect(out);
      send(out, 1, 0.5);
    },
    bass({ freq, vel = 0.5, dur = 0.8 }, when) {
      const end = when + dur;
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 420;
      oscillator('sine', freq, when, end + 0.05).connect(tone);
      const grit = ctx.createGain();
      grit.gain.value = 0.3;
      oscillator('triangle', freq, when, end + 0.05).connect(grit).connect(tone);
      const out = envelope(when, vel * 0.5, 0.012, end);
      tone.connect(out);
      send(out, 1, 0.08);
    },
    whoosh({ vel = 0.4, dur = 0.5 }, when) {
      const source = ctx.createBufferSource();
      source.buffer = noise;
      source.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.Q.value = 1.1;
      band.frequency.setValueAtTime(500, when);
      band.frequency.exponentialRampToValueAtTime(2600, when + dur);
      const out = envelope(when, vel * 0.34, dur * 0.45, when + dur);
      source.connect(band).connect(out);
      source.start(when, (when * 0.37) % 1.5);
      source.stop(when + dur + 0.05);
      send(out, 1, 0.4);
    },
    swish({ level = 0 }, when) {
      if (!bed) {
        const source = ctx.createBufferSource();
        source.buffer = noise;
        source.loop = true;
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 850;
        band.Q.value = 0.5;
        bed = ctx.createGain();
        bed.gain.value = 0;
        source.connect(band).connect(bed);
        send(bed, 1, 0.3);
        source.start(when);
      }
      bed.gain.setTargetAtTime(level * 0.5, when, 0.12);
    },
  };

  return {
    play(voice, params, when) {
      voices[voice](params, Math.max(when, ctx.currentTime));
    },
  };
}
