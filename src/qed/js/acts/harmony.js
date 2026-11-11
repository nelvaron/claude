import { easeOut, ramp } from '../core/math.js';
import { BAR, STEP, harmonise, hertz, melodyOf } from '../audio/score.js';

const START = 0.7;
const RISE = 0.38;
const LOOKAHEAD = 0.12;
const LOW = 60;
const HIGH = 88;

/**
 * Proof of harmony: plays the sentence as a melody, one letter per note, over chords chosen to
 * fit it. Each letter's grains rise to the pitch they sound at, so the sentence becomes its score.
 * @type {import('../stage/stage.js').ProofFactory}
 */
export const harmony = {
  anchor: 0.58,
  create({ P, home, sentence, view, audio, hud, palette }) {
    const melody = melodyOf(sentence.text);
    const chords = harmonise(melody);
    const length = chords.length * BAR;

    const left = view.left + Math.max(22, (view.width - 880) / 2);
    const right = view.left + view.width - Math.max(22, (view.width - 880) / 2);
    const roofY = view.top + 96;
    const baseY = home.box.top - 58;
    const xOf = (step) => left + ((right - left) * step) / length;
    const yOf = (midi) => baseY - ((baseY - roofY) * (midi - LOW)) / (HIGH - LOW);
    const stepWidth = (right - left) / length;

    const hit = new Float32Array(sentence.text.length).fill(Infinity);
    const noteX = new Float32Array(sentence.text.length);
    const noteY = new Float32Array(sentence.text.length);
    const noteW = new Float32Array(sentence.text.length);
    for (const note of melody.notes) {
      hit[note.index] = START + note.step * STEP;
      noteX[note.index] = xOf(note.step);
      noteY[note.index] = yOf(note.midi);
      noteW[note.index] = Math.max(3, stepWidth * note.length - 3);
    }

    let nextNote = 0;
    let nextBar = 0;
    const ending = START + (length - BAR) * STEP;
    hud.caption('One letter, one note. The chords underneath are chosen as it plays.');

    return {
      duration: START + length * STEP + 1.5,
      update(dt, t) {
        const horizon = t + LOOKAHEAD;
        for (; nextNote < melody.notes.length; nextNote++) {
          const note = melody.notes[nextNote];
          const at = START + note.step * STEP;
          if (at > horizon) break;
          audio.play('pluck', { freq: hertz(note.midi), vel: note.accent ? 0.62 : 0.4, dur: 0.5 + 0.28 * note.length, echo: 0.28 }, Math.max(0, at - t));
        }
        for (; nextBar < chords.length; nextBar++) {
          const at = START + nextBar * BAR * STEP;
          if (at > horizon) break;
          const chord = chords[nextBar];
          const delay = Math.max(0, at - t);
          const final = nextBar === chords.length - 1;
          const span = BAR * STEP * (final ? 2.2 : 1);
          audio.play('pad', { freqs: chord.tones.map((pc) => hertz(48 + pc)), vel: 0.55, dur: span }, delay);
          audio.play('bass', { freq: hertz(36 + chord.root), vel: 0.6, dur: span * 0.9 }, delay);
          if (final) chord.tones.forEach((pc, i) => audio.play('bell', { freq: hertz(72 + pc), vel: 0.28, dur: 2.2 }, delay + i * 0.11));
          else audio.play('bass', { freq: hertz(43 + chord.root), vel: 0.4, dur: STEP * 3 }, delay + STEP * 4);
        }
        const bar = Math.floor((t - START) / (BAR * STEP));
        hud.readout(bar >= 0 && bar < chords.length ? chords[bar].name : '');

        for (let i = 0; i < P.count; i++) {
          const g = P.glyph[i];
          const since = g >= 0 ? t - hit[g] : -1;
          if (since < 0) {
            P.x[i] = home.x[i];
            P.y[i] = home.y[i];
            P.tint[i] = 0;
            P.size[i] = 1;
            P.alpha[i] = g >= 0 && hit[g] === Infinity ? 0.4 : 0.9;
            continue;
          }
          const e = easeOut(Math.min(1, since / RISE));
          // Numbers in [0, 1) that stay the same for this grain from frame to frame.
          const r1 = (i * 0.61803) % 1;
          const r2 = (i * 0.75488) % 1;
          const r3 = (i * 0.56984) % 1;
          const r4 = (i * 0.32471) % 1;
          // Nearly half the grains draw the note itself; the rest glow around it.
          const core = r1 < 0.45;
          const tx = core ? noteX[g] + P.seed[i] * noteW[g] : noteX[g] + noteW[g] / 2 + (r2 + P.seed[i] - 1) * 30;
          const ty = core ? noteY[g] + (r2 - 0.5) * 3.4 : noteY[g] + (r3 + r4 - 1) * 26;
          P.x[i] = home.x[i] + (tx - home.x[i]) * e;
          P.y[i] = home.y[i] + (ty - home.y[i]) * e - Math.sin(Math.PI * e) * 14;
          const ring = Math.exp(-since * 1.6);
          P.tint[i] = ring;
          P.size[i] = 1 + 0.9 * ring;
          P.alpha[i] = core ? 1 : 0.16 + 0.5 * ring;
        }
      },
      draw(g, t, fade) {
        const { inkCss, accentCss } = palette.current;
        g.font = '500 16px "QED Serif", Georgia, serif';
        g.textBaseline = 'top';
        chords.forEach((chord, bar) => {
          const at = START + bar * BAR * STEP;
          const shown = ramp(t, at - 0.1, at + 0.25) * fade;
          if (shown <= 0) return;
          const x = xOf(bar * BAR);
          const sounding = t >= at && t < at + BAR * STEP && t < ending + BAR * STEP;
          g.fillStyle = inkCss(0.16 * shown);
          g.fillRect(Math.round(x) - 0.5, roofY - 8, 1, baseY - roofY + 16);
          g.fillStyle = sounding ? accentCss(shown) : inkCss(0.6 * shown);
          g.fillText(chord.name, x + 5, baseY + 14);
        });
        const play = xOf((t - START) / STEP);
        if (t > START && play < right) {
          g.fillStyle = accentCss(0.5 * fade);
          g.fillRect(play, roofY - 8, 1.2, baseY - roofY + 16);
        }
      },
    };
  },
};
