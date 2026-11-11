import { easeInOut, saturate } from '../core/math.js';

/**
 * Starts a flight from wherever the grains are now. Grains leave in index order, so a sentence
 * unravels from its first letter to its last.
 * @param {ReturnType<import('./particles.js').createParticles>} P
 * @param {() => number} random
 * @param {number} [stagger] share of the flight, 0..1, over which departures are spread
 */
export function beginFlight(P, random, stagger = 0.35) {
  for (let i = 0; i < P.count; i++) {
    P.sx[i] = P.x[i];
    P.sy[i] = P.y[i];
    P.delay[i] = stagger * (0.7 * (i / P.count) + 0.3 * random());
    P.bend[i] = (random() - 0.5) * 0.3;
    P.vx[i] = 0;
    P.vy[i] = 0;
  }
}

/**
 * Places every grain along its flight, on a shallow arc from its start to its destination.
 * @param {ReturnType<import('./particles.js').createParticles>} P
 * @param {Float32Array} toX destination per grain
 * @param {Float32Array} toY
 * @param {number} progress 0 at take-off, 1 when every grain has landed
 * @param {number} [stagger] the value given to beginFlight
 */
export function fly(P, toX, toY, progress, stagger = 0.35) {
  const span = 1 - stagger;
  for (let i = 0; i < P.count; i++) {
    const e = easeInOut(saturate((progress - P.delay[i]) / span));
    const dx = toX[i] - P.sx[i];
    const dy = toY[i] - P.sy[i];
    const arc = Math.sin(Math.PI * e) * P.bend[i];
    P.x[i] = P.sx[i] + dx * e - dy * arc;
    P.y[i] = P.sy[i] + dy * e + dx * arc;
  }
}

/**
 * Eases every grain's look back toward plain ink.
 * @param {ReturnType<import('./particles.js').createParticles>} P
 * @param {number} dt seconds
 * @param {number} [rate] per second
 */
export function relaxLooks(P, dt, rate = 5) {
  const k = 1 - Math.exp(-rate * dt);
  for (let i = 0; i < P.count; i++) {
    P.alpha[i] += (1 - P.alpha[i]) * k;
    P.size[i] += (1 - P.size[i]) * k;
    P.tint[i] -= P.tint[i] * k;
  }
}
