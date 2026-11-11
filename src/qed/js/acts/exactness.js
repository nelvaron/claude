import { ramp } from '../core/math.js';
import { audit } from '../lang/autogram.js';

// Seconds given to each count: slow enough to follow at first, then brisk.
const PACE = [1.6, 1.3, 0.8, 0.6];
const BRISK = 0.34;
const TICK_GAP = 0.045;

/**
 * Proof of exactness: counts every letter the sentence uses, in front of the viewer, and checks
 * each count against the number the sentence claims for it.
 * @type {import('../stage/stage.js').ProofFactory}
 */
export const exactness = {
  anchor: 0.2,
  create({ P, home, sentence, audio, hud }) {
    const text = sentence.text;
    let cursor = 0.5;
    const beats = audit(text).map((claim, i) => {
      const beat = { ...claim, at: cursor, span: PACE[i] ?? BRISK, shown: 0, checked: false };
      cursor += beat.span;
      return beat;
    });
    const counted = cursor;
    const flare = new Float32Array(text.length);
    const mark = new Float32Array(text.length);
    let correct = 0;
    let lastTick = -1;

    return {
      duration: counted + 1.9,
      update(dt, t) {
        const fade = Math.exp(-5 * dt);
        for (let k = 0; k < flare.length; k++) flare[k] *= fade;

        for (const beat of beats) {
          if (t < beat.at) break;
          if (beat.checked) continue;
          const u = (t - beat.at) / beat.span;
          const due = Math.ceil(ramp(u, 0, 0.7) * beat.actual);
          while (beat.shown < due) {
            flare[beat.positions[beat.shown++]] = 1;
            if (t - lastTick > TICK_GAP) {
              audio.play('tick', { freq: 880 * 2 ** (Math.min(beat.shown, 24) / 24), vel: 0.4 });
              lastTick = t;
            }
          }
          const right = beat.actual === beat.claimed;
          if (u >= 0.8) {
            beat.checked = true;
            if (right) {
              correct++;
              for (let k = beat.start; k <= beat.end + 1; k++) mark[k] = 1;
              audio.play('bell', { freq: 1318.5, vel: 0.16, dur: 0.9 });
            }
          }
          hud.readout(`${beat.letter} × ${beat.shown}${beat.checked ? (right ? ' ✓' : ' ✗') : ''}`);
        }

        const done = ramp(t, counted, counted + 0.5);
        if (done > 0) {
          hud.readout(`${correct} of ${beats.length} ✓`);
          hud.caption(`${beats.length} counts claimed, ${correct} correct. The sentence describes itself exactly.`);
        } else {
          hud.caption('Counting each letter, then checking it against what the sentence says.');
        }

        for (let i = 0; i < P.count; i++) {
          const g = P.glyph[i];
          const f = g >= 0 ? flare[g] : 0;
          const lit = Math.max(f, g >= 0 ? mark[g] : 0);
          P.x[i] = home.x[i];
          P.y[i] = home.y[i] - f * 5;
          P.alpha[i] = 0.42 + 0.58 * Math.max(lit, done);
          P.size[i] = 1 + 0.9 * f;
          P.tint[i] = lit;
        }
      },
    };
  },
};
