const PRESSURE_SWEEPS = 14;

/**
 * Creates a two-dimensional incompressible fluid on a grid, after Jos Stam's "Stable Fluids"
 * (SIGGRAPH 1999), with vorticity confinement to keep small swirls alive. The fluid sits in a
 * closed box. Lengths are in cells and velocities in cells per second.
 * @param {number} cols
 * @param {number} rows
 * @returns {{cols: number, rows: number,
 *   push(x: number, y: number, vx: number, vy: number, radius: number): void,
 *   step(dt: number): void,
 *   velocityAt(x: number, y: number, out: Float32Array): void}}
 *   push drags the fluid around (x, y) toward a velocity; velocityAt writes [vx, vy] at a point
 */
export function createFluid(cols, rows) {
  const W = cols + 2;
  const size = W * (rows + 2);
  let u = new Float32Array(size);
  let v = new Float32Array(size);
  let u0 = new Float32Array(size);
  let v0 = new Float32Array(size);
  const pressure = new Float32Array(size);
  const divergence = new Float32Array(size);
  const curl = new Float32Array(size);

  /** Walls: no flow through them, free slip along them. */
  function bound(field, flipX, flipY) {
    for (let i = 1; i <= cols; i++) {
      field[i] = flipY * field[i + W];
      field[i + W * (rows + 1)] = flipY * field[i + W * rows];
    }
    for (let j = 0; j <= rows + 1; j++) {
      field[W * j] = flipX * field[1 + W * j];
      field[cols + 1 + W * j] = flipX * field[cols + W * j];
    }
  }

  function project() {
    for (let j = 1; j <= rows; j++) {
      for (let i = 1, k = 1 + W * j; i <= cols; i++, k++) {
        divergence[k] = -0.5 * (u[k + 1] - u[k - 1] + v[k + W] - v[k - W]);
        pressure[k] = 0;
      }
    }
    bound(divergence, 1, 1);
    for (let sweep = 0; sweep < PRESSURE_SWEEPS; sweep++) {
      for (let j = 1; j <= rows; j++) {
        for (let i = 1, k = 1 + W * j; i <= cols; i++, k++) {
          pressure[k] = (divergence[k] + pressure[k - 1] + pressure[k + 1] + pressure[k - W] + pressure[k + W]) * 0.25;
        }
      }
      bound(pressure, 1, 1);
    }
    for (let j = 1; j <= rows; j++) {
      for (let i = 1, k = 1 + W * j; i <= cols; i++, k++) {
        u[k] -= 0.5 * (pressure[k + 1] - pressure[k - 1]);
        v[k] -= 0.5 * (pressure[k + W] - pressure[k - W]);
      }
    }
    bound(u, -1, 1);
    bound(v, 1, -1);
  }

  function sample(field, x, y) {
    x = x < 0.5 ? 0.5 : x > cols + 0.5 ? cols + 0.5 : x;
    y = y < 0.5 ? 0.5 : y > rows + 0.5 ? rows + 0.5 : y;
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = x - i;
    const fy = y - j;
    const k = i + W * j;
    return (1 - fx) * ((1 - fy) * field[k] + fy * field[k + W]) + fx * ((1 - fy) * field[k + 1] + fy * field[k + 1 + W]);
  }

  function advect(dt) {
    [u, u0] = [u0, u];
    [v, v0] = [v0, v];
    for (let j = 1; j <= rows; j++) {
      for (let i = 1, k = 1 + W * j; i <= cols; i++, k++) {
        const x = i - dt * u0[k];
        const y = j - dt * v0[k];
        u[k] = sample(u0, x, y);
        v[k] = sample(v0, x, y);
      }
    }
    bound(u, -1, 1);
    bound(v, 1, -1);
  }

  function confine(dt, strength) {
    for (let j = 1; j <= rows; j++) {
      for (let i = 1, k = 1 + W * j; i <= cols; i++, k++) {
        curl[k] = 0.5 * (v[k + 1] - v[k - 1] - u[k + W] + u[k - W]);
      }
    }
    for (let j = 2; j < rows; j++) {
      for (let i = 2, k = 2 + W * j; i < cols; i++, k++) {
        const gx = 0.5 * (Math.abs(curl[k + 1]) - Math.abs(curl[k - 1]));
        const gy = 0.5 * (Math.abs(curl[k + W]) - Math.abs(curl[k - W]));
        const length = Math.hypot(gx, gy) + 1e-5;
        u[k] += dt * strength * (gy / length) * curl[k];
        v[k] -= dt * strength * (gx / length) * curl[k];
      }
    }
  }

  return {
    cols,
    rows,
    push(x, y, vx, vy, radius) {
      const i0 = Math.max(1, Math.floor(x - radius * 2));
      const i1 = Math.min(cols, Math.ceil(x + radius * 2));
      const j0 = Math.max(1, Math.floor(y - radius * 2));
      const j1 = Math.min(rows, Math.ceil(y + radius * 2));
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const w = Math.exp(-((i - x) ** 2 + (j - y) ** 2) / (radius * radius));
          const k = i + W * j;
          u[k] += (vx - u[k]) * w;
          v[k] += (vy - v[k]) * w;
        }
      }
    },
    step(dt) {
      confine(dt, 6);
      project();
      advect(dt);
      project();
      const drag = Math.exp(-0.55 * dt);
      for (let k = 0; k < size; k++) {
        u[k] *= drag;
        v[k] *= drag;
      }
    },
    velocityAt(x, y, out) {
      out[0] = sample(u, x, y);
      out[1] = sample(v, x, y);
    },
  };
}
