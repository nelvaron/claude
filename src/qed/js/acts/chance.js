import { clamp, easeInOut, popcount, ramp } from '../core/math.js';
import { hertz } from '../audio/score.js';

// Seconds: the stream of grains, one grain's flight to the top peg, one peg, the last drop.
const POUR = 5.1;
const APPROACH = 0.7;
const PEG = 0.078;
const DROP = 0.42;
const START = 0.9;

const PLINKS = [72, 74, 76, 79, 81, 84, 86, 88];

/** Probability of exactly k heads in n fair coin flips. */
function binomial(n, k) {
  let p = 0.5 ** n;
  for (let i = 0; i < k; i++) p *= (n - i) / (i + 1);
  return p;
}

/**
 * Proof of chance: every grain falls through rows of pegs, going left or right at each on a coin
 * flip. The bell curve the heap must make is drawn first; the grains then fill it.
 * @type {import('../stage/stage.js').ProofFactory}
 */
export const chance = {
  anchor: 0.09,
  create({ P, home, view, random, audio, hud, palette }) {
    const N = P.count;
    const floor = view.floor;
    const top = Math.max(home.box.bottom + 30, view.top + view.height * 0.3);
    const width = Math.min(view.width - 28, 780);
    const rows = clamp(2 * Math.round(width / 62), 10, 22);
    const bin = width / (rows + 1);
    const cx = view.left + view.width / 2;
    const rowHeight = ((floor - top) * 0.46) / rows;
    const heapTop = top + rows * rowHeight + 14;
    const sigma = Math.sqrt(rows) / 2;

    // Grains are packed into each bin `perRow` across; `rise` is chosen so the tallest bin
    // exactly fills the room there is.
    const perRow = Math.max(4, Math.floor((bin - 3) / 1.3));
    const rise = Math.min(1.3, (floor - heapTop) / ((N * binomial(rows, rows / 2)) / perRow));
    const predicted = (b) => ((N / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-((b - rows / 2) ** 2) / (2 * sigma * sigma)) * rise) / perRow;

    const release = new Float32Array(N);
    const flips = new Uint32Array(N);
    const slot = new Int32Array(N).fill(-1);
    const landX = new Float32Array(N);
    const landY = new Float32Array(N);
    const heap = new Int32Array(rows + 1);
    for (let i = 0; i < N; i++) {
      release[i] = START + (i / N) * POUR + random() * 0.3;
      flips[i] = random.bits();
    }
    const mask = 2 ** rows - 1;
    const pegsEnd = APPROACH + rows * PEG;
    const settled = START + POUR + 0.3 + pegsEnd + DROP;
    let plinkDue = 0;
    let landed = 0;

    return {
      duration: settled + 2.2,
      update(dt, t) {
        let falling = 0;
        for (let i = 0; i < N; i++) {
          const s = t - release[i];
          if (s < 0) {
            P.x[i] = home.x[i];
            P.y[i] = home.y[i];
            continue;
          }
          const wobble = (P.seed[i] - 0.5) * bin * 0.3;
          if (s < APPROACH) {
            const u = s / APPROACH;
            P.x[i] = home.x[i] + (cx + wobble - home.x[i]) * easeInOut(u);
            P.y[i] = home.y[i] + (top - home.y[i]) * u * u;
          } else if (s < pegsEnd) {
            falling++;
            const q = (s - APPROACH) / PEG;
            const row = Math.floor(q);
            const f = q - row;
            const rights = popcount(flips[i] & (2 ** row - 1));
            const step = (flips[i] >>> row) & 1 ? 0.5 : -0.5;
            P.x[i] = cx + wobble + (rights - row / 2 + step * f ** 0.7) * bin;
            P.y[i] = top + (row + f * f * 0.55 + f * 0.45 - 0.3 * Math.sin(Math.PI * f)) * rowHeight;
          } else {
            if (slot[i] < 0) {
              const b = popcount(flips[i] & mask);
              slot[i] = heap[b]++;
              landed++;
              landX[i] = cx + (b - rows / 2 - 0.5) * bin + 1.5 + ((slot[i] % perRow) + P.seed[i]) * ((bin - 3) / perRow);
              landY[i] = floor - Math.floor(slot[i] / perRow) * rise - P.seed[i] * rise;
            }
            const u = Math.min(1, (s - pegsEnd) / DROP);
            const fromX = cx + wobble + (popcount(flips[i] & mask) - rows / 2) * bin;
            P.x[i] = fromX + (landX[i] - fromX) * u;
            P.y[i] = top + rows * rowHeight + (landY[i] - top - rows * rowHeight) * u * u;
          }
          P.tint[i] = 0;
        }

        plinkDue -= dt;
        if (falling > 0 && plinkDue <= 0) {
          const midi = PLINKS[Math.floor(random() * PLINKS.length)];
          audio.play('pluck', { freq: hertz(midi), vel: 0.3 + 0.25 * random(), dur: 0.5 });
          plinkDue = 0.04 + 0.4 / (1 + falling / 400);
        }

        const mode = rows / 2;
        const expected = Math.round(N * binomial(rows, mode));
        hud.readout(landed ? landed.toLocaleString('en') : '');
        hud.caption(t < settled
          ? `${N.toLocaleString('en')} grains, ${rows} coin flips each. The dashed curve was drawn first.`
          : `Middle column: ${expected.toLocaleString('en')} predicted, ${heap[mode].toLocaleString('en')} landed.`);
      },
      draw(g, t, fade) {
        const { inkCss, accentCss } = palette.current;
        g.fillStyle = inkCss(0.34 * fade * ramp(t, 0, 0.6));
        for (let row = 0; row < rows; row++) {
          for (let k = 0; k <= row; k++) {
            g.beginPath();
            g.arc(cx + (k - row / 2) * bin, top + (row + 0.12) * rowHeight, 1.6, 0, Math.PI * 2);
            g.fill();
          }
        }
        g.strokeStyle = inkCss(0.25 * fade);
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(cx - width / 2, floor + 2.5);
        g.lineTo(cx + width / 2, floor + 2.5);
        g.stroke();

        // The prediction is drawn left to right before the first grain lands.
        const reveal = ramp(t, 0.3, 1.5);
        g.strokeStyle = accentCss(0.95 * fade);
        g.lineWidth = 1.6;
        g.setLineDash([5, 4]);
        g.beginPath();
        const last = -0.5 + (rows + 1) * reveal;
        for (let b = -0.5; b <= last; b += 0.1) {
          const x = cx + (b - rows / 2) * bin;
          const y = floor - predicted(b);
          if (b === -0.5) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
        g.setLineDash([]);
      },
    };
  },
};
