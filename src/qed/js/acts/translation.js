import { hertz } from '../audio/score.js';
import { fontOf, sampleText } from '../gfx/glyphs.js';
import { translationsFor } from '../lang/languages.js';

const START = 0.5;
// Seconds each language is held: unhurried at first, then quick, then slowing to a stop.
const hold = (i, n) => (i < 2 ? 1.0 : i > n - 3 ? 0.8 : 0.47);
const SPRING = 150;
const SCALE = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];

/**
 * Proof of translation: re-sets the sentence in one language after another, in the same column,
 * using the same grains. The viewer's own language comes first when it is among them.
 * @type {import('../stage/stage.js').ProofFactory}
 */
export const translation = {
  anchor: 0.36,
  create({ P, home, sentence, random, audio, hud }) {
    const N = P.count;
    const style = getComputedStyle(sentence.el);
    const italic = fontOf(sentence.words[0].el);
    const column = {
      left: home.box.left,
      top: home.box.top,
      width: sentence.el.parentElement.getBoundingClientRect().right + window.scrollX - home.box.left,
      lineHeight: parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.45,
    };
    const languages = translationsFor(navigator.languages ?? [navigator.language]);
    const total = languages.length + 1;

    let at = START;
    const cues = languages.map((language, i) => {
      const cue = { language, at };
      at += hold(i, languages.length);
      return cue;
    });
    const english = at;

    // Grains keep their left-to-right rank from one language to the next, so they shimmer into
    // place instead of crossing the whole line.
    const rank = Array.from({ length: N }, (_, i) => i).sort((a, b) => home.x[a] - home.x[b]);
    const damping = 2 * Math.sqrt(SPRING);
    let shown = -1;
    P.tx.set(home.x);
    P.ty.set(home.y);

    function set(target, index, name) {
      for (let k = 0; k < N; k++) {
        P.tx[rank[k]] = target.x[k];
        P.ty[rank[k]] = target.y[k];
      }
      hud.readout(name);
      hud.caption(`${index} of ${total}`);
      audio.play('whoosh', { vel: 0.4, dur: 0.3 });
      audio.play('pluck', { freq: hertz(SCALE[index % SCALE.length] + 12 * Math.floor(index / SCALE.length)), vel: 0.6, dur: 0.7, echo: 0.25 });
    }

    hud.readout('English');
    hud.caption(`1 of ${total}`);

    return {
      duration: english + 1.3,
      update(dt, t) {
        while (shown + 1 < cues.length && t >= cues[shown + 1].at) {
          shown++;
          const { language } = cues[shown];
          const font = language.upright ? italic.replace(/^italic/, 'normal') : italic;
          set(sampleText(language.text, { ...column, font, rtl: language.rtl }, N, random), shown + 2, language.name);
        }
        if (shown === cues.length - 1 && t >= english) {
          shown++;
          const byRank = { x: new Float32Array(N), y: new Float32Array(N) };
          rank.forEach((i, k) => {
            byRank.x[k] = home.x[i];
            byRank.y[k] = home.y[i];
          });
          set(byRank, 1, 'English');
          hud.caption(`${total} languages, one meaning.`);
        }
        for (let i = 0; i < N; i++) {
          P.vx[i] += ((P.tx[i] - P.x[i]) * SPRING - P.vx[i] * damping) * dt;
          P.vy[i] += ((P.ty[i] - P.y[i]) * SPRING - P.vy[i] * damping) * dt;
          P.x[i] += P.vx[i] * dt;
          P.y[i] += P.vy[i] * dt;
          P.tint[i] = Math.min(0.9, Math.hypot(P.vx[i], P.vy[i]) / 500);
        }
      },
    };
  },
};
