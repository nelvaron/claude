import { clamp } from '../core/math.js';
import { createFluid } from '../sim/fluid.js';

const CELL = 9;
const MAX_FLOW = 70;

/**
 * Proof of wet ink: the sentence's grains are carried by a simulated fluid that the viewer stirs.
 * @type {import('../stage/stage.js').ProofFactory}
 */
export const ink = {
  anchor: 0.36,
  create({ P, home, view, pointer, audio, hud }) {
    const cols = clamp(Math.round(view.width / CELL), 56, 150);
    const cell = view.width / cols;
    const rows = Math.ceil(view.height / cell);
    const fluid = createFluid(cols, rows);
    const flow = new Float32Array(2);
    const cx = (home.box.left + home.box.right) / 2;
    const cy = (home.box.top + home.box.bottom) / 2;
    const rx = (home.box.right - home.box.left) / 2;
    const ry = Math.max(46, (home.box.bottom - home.box.top) / 2 + 24);
    let rush = 0;
    hud.caption(`A fluid solver on a ${cols} × ${rows} grid. Drag through the sentence.`);

    return {
      duration: 9.5,
      openEnded: true,
      ghost(t) {
        if (t < 0.5) return null;
        const s = (t - 0.5) * 1.3;
        return { x: cx + rx * Math.sin(s + 4.3), y: cy + ry * 1.5 * Math.sin(s * 2.3) };
      },
      update(dt) {
        const speed = Math.hypot(pointer.dx, pointer.dy) / dt;
        if (pointer.present && speed > 1) {
          const limit = Math.min(1, (MAX_FLOW * cell) / speed);
          fluid.push(
            (pointer.x - view.left) / cell + 0.5,
            (pointer.y - view.top) / cell + 0.5,
            (pointer.dx / dt / cell) * limit,
            (pointer.dy / dt / cell) * limit,
            pointer.down ? 3.4 : 2.4,
          );
        }
        fluid.step(dt);
        rush += (Math.min(1, speed / 650) - rush) * Math.min(1, dt * 6);
        audio.play('swish', { level: rush });

        const right = view.left + view.width - 2;
        const bottom = view.top + view.height - 2;
        for (let i = 0; i < P.count; i++) {
          fluid.velocityAt((P.x[i] - view.left) / cell + 0.5, (P.y[i] - view.top) / cell + 0.5, flow);
          P.x[i] = clamp(P.x[i] + flow[0] * cell * dt, view.left + 2, right);
          P.y[i] = clamp(P.y[i] + flow[1] * cell * dt, view.top + 2, bottom);
          P.tint[i] = Math.min(0.85, Math.hypot(flow[0], flow[1]) / 34);
        }
      },
    };
  },
};
