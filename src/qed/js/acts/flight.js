import { clamp } from '../core/math.js';

const CELL = 26;
const TAKE_OFF = 0.3;
const HAWK_REACH = 150;

const RULES = [
  [0, 'Rule one: stay close to the others.'],
  [2.4, 'Rule two: keep a little apart.'],
  [4.8, 'Rule three: match your neighbours.'],
  [7.2, 'Nothing else is steering them. Your pointer is the hawk.'],
];

/**
 * Proof of flight: every grain follows three local rules (cohesion, separation, alignment), read
 * off a coarse grid of the flock's density and average heading, and the swarm flies as a flock.
 * @type {import('../stage/stage.js').ProofFactory}
 */
export const flight = {
  anchor: 0.42,
  create({ P, home, view, pointer, random, audio, hud }) {
    const N = P.count;
    const cols = Math.ceil(view.width / CELL) + 2;
    const rows = Math.ceil(view.height / CELL) + 2;
    const cells = cols * rows;
    const count = new Float32Array(cells);
    const sumX = new Float32Array(cells);
    const sumY = new Float32Array(cells);
    const density = new Float32Array(cells);
    const headingX = new Float32Array(cells);
    const headingY = new Float32Array(cells);

    const cruise = clamp(Math.min(view.width, view.height) * 0.42, 150, 320);
    const cx = view.left + view.width / 2;
    const cy = view.top + view.height * 0.46;
    // The density at which a grain stops closing in and starts making room.
    const comfortable = (N / cells) * 4;
    const span = home.box.right - home.box.left || 1;
    const release = Float32Array.from({ length: N }, (_, i) => TAKE_OFF + ((home.x[i] - home.box.left) / span) * 1.1 + random() * 0.2);
    const aloft = new Uint8Array(N);
    let rule = -1;

    const cellOf = (x, y) => {
      const i = clamp(Math.floor((x - view.left) / CELL) + 1, 0, cols - 1);
      const j = clamp(Math.floor((y - view.top) / CELL) + 1, 0, rows - 1);
      return i + cols * j;
    };

    return {
      duration: 10.6,
      openEnded: true,
      ghost(t) {
        // A hawk that crosses the flock every few seconds, from alternating sides.
        const pass = (t - 3.4) / 3.1;
        const u = pass - Math.floor(pass);
        if (pass < 0 || u > 0.42) return null;
        const side = Math.floor(pass) % 2 ? -1 : 1;
        const sweep = (u / 0.42) * 2 - 1;
        return { x: cx + side * sweep * view.width * 0.5, y: cy + sweep * side * view.height * 0.22 };
      },
      update(dt, t) {
        while (rule + 1 < RULES.length && t >= RULES[rule + 1][0]) hud.caption(RULES[++rule][1]);

        count.fill(0);
        sumX.fill(0);
        sumY.fill(0);
        for (let i = 0; i < N; i++) {
          if (!aloft[i]) continue;
          const c = cellOf(P.x[i], P.y[i]);
          count[c]++;
          sumX[c] += P.vx[i];
          sumY[c] += P.vy[i];
        }
        for (let j = 1; j < rows - 1; j++) {
          for (let i = 1, c = 1 + cols * j; i < cols - 1; i++, c++) {
            let n = 0;
            let vx = 0;
            let vy = 0;
            for (let dj = -cols; dj <= cols; dj += cols) {
              for (let di = -1; di <= 1; di++) {
                n += count[c + dj + di];
                vx += sumX[c + dj + di];
                vy += sumY[c + dj + di];
              }
            }
            density[c] = n / 9;
            headingX[c] = n ? vx / n : 0;
            headingY[c] = n ? vy / n : 0;
          }
        }

        const hawk = pointer.present;
        let fear = 0;
        for (let i = 0; i < N; i++) {
          if (!aloft[i]) {
            if (t < release[i]) {
              P.x[i] = home.x[i];
              P.y[i] = home.y[i];
              continue;
            }
            aloft[i] = 1;
            P.vx[i] = (random() - 0.5) * cruise;
            P.vy[i] = -cruise * (0.5 + 0.6 * random());
          }
          const depth = P.seed[i];
          const x = P.x[i];
          const y = P.y[i];
          const c = cellOf(x, y);
          const inside = c > cols && c < cells - cols - 1;

          // Alignment: turn toward the neighbourhood's average heading.
          let ax = (headingX[c] - P.vx[i]) * 1.3;
          let ay = (headingY[c] - P.vy[i]) * 1.3;
          if (inside) {
            // Cohesion climbs toward denser air; separation descends once it is too dense.
            const crowd = density[c] / comfortable;
            const pull = (crowd < 1 ? 200 : -500 * (crowd - 1)) / comfortable;
            ax += (density[c + 1] - density[c - 1]) * pull;
            ay += (density[c + cols] - density[c - cols]) * pull;
          }
          // Starlings stay over their roost: the farther out, the harder the turn for home.
          const homing = 1.6 + 1.2 * depth;
          ax += (cx - x) * homing;
          ay += (cy - y) * homing * 1.9;
          if (hawk) {
            const hx = x - pointer.x;
            const hy = y - pointer.y;
            const d = Math.hypot(hx, hy) + 1;
            if (d < HAWK_REACH) {
              const panic = (1 - d / HAWK_REACH) * 5200;
              ax += (hx / d) * panic;
              ay += (hy / d) * panic;
              fear++;
            }
          }
          ax += Math.sin(depth * 91 + t * 1.7) * 60;
          ay += Math.cos(depth * 57 + t * 1.3) * 60;

          let vx = P.vx[i] + ax * dt;
          let vy = P.vy[i] + ay * dt;
          const speed = Math.hypot(vx, vy) + 0.001;
          const wanted = cruise * (0.6 + 0.8 * depth);
          const k = 1 + ((wanted - speed) / speed) * Math.min(1, dt * 3);
          vx *= k;
          vy *= k;
          P.vx[i] = vx;
          P.vy[i] = vy;
          P.x[i] = x + vx * dt;
          P.y[i] = y + vy * dt;
          P.size[i] = 0.7 + 0.75 * depth;
          P.alpha[i] = 0.45 + 0.55 * depth;
          P.tint[i] = 0;
        }
        audio.play('swish', { level: clamp(0.25 + (fear / N) * 6, 0, 1) * Math.min(1, t / 1.5) });
      },
    };
  },
};
