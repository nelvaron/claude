import { createSynth } from './synth.js';

/**
 * @typedef {object} Audio
 * @property {(voice: string, params: object, delay?: number) => void} play sounds a voice of the
 *   synth `delay` seconds from now (see synth.js for voices); silent until unlocked, or when muted
 * @property {() => void} unlock starts the audio system; browsers only allow it from inside a
 *   click, tap or key press
 * @property {boolean} on whether sound is currently audible
 * @property {() => boolean} toggle mutes or unmutes; returns the new value of `on`
 */

/**
 * Creates the page's sound output.
 * @returns {Audio}
 */
export function createAudio() {
  let ctx = null;
  let synth = null;
  let muted = false;

  return {
    play(voice, params, delay = 0) {
      if (!synth || muted || ctx.state !== 'running') return;
      synth.play(voice, params, ctx.currentTime + 0.02 + delay);
    },
    unlock() {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!ctx) {
        ctx = new AudioContext();
        synth = createSynth(ctx);
      }
      if (ctx.state === 'suspended') ctx.resume();
    },
    get on() {
      return Boolean(ctx) && !muted;
    },
    toggle() {
      if (!ctx) this.unlock();
      else muted = !muted;
      if (synth && muted) synth.play('swish', { level: 0 }, ctx.currentTime);
      return this.on;
    },
  };
}

function wav(buffer) {
  const channels = buffer.numberOfChannels;
  const frames = buffer.length;
  const view = new DataView(new ArrayBuffer(44 + frames * channels * 2));
  const ascii = (offset, text) => Array.from(text).forEach((ch, i) => view.setUint8(offset + i, ch.charCodeAt(0)));
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + frames * channels * 2, true);
  ascii(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, frames * channels * 2, true);
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  for (let i = 0, o = 44; i < frames; i++) {
    for (let c = 0; c < channels; c++, o += 2) {
      view.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 32767, true);
    }
  }
  return new Uint8Array(view.buffer);
}

/**
 * Creates a sound output that plays nothing and writes down everything it is asked to play, so
 * the soundtrack of a filmed run can be rendered afterwards, exactly in step with the picture.
 * @param {{now: number}} clock
 * @returns {Audio & {render(seconds: number): Promise<Uint8Array>}} render resolves to a 16-bit
 *   stereo WAV file of the first `seconds` of everything recorded
 */
export function createAudioRecorder(clock) {
  const log = [];
  return {
    play(voice, params, delay = 0) {
      log.push({ voice, params, at: clock.now + delay });
    },
    unlock() {},
    on: true,
    toggle: () => true,
    async render(seconds) {
      const ctx = new OfflineAudioContext(2, Math.ceil(seconds * 44100), 44100);
      const synth = createSynth(ctx);
      for (const event of log) synth.play(event.voice, event.params, event.at);
      return wav(await ctx.startRendering());
    },
  };
}
