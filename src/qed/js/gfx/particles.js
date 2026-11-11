/**
 * Allocates the swarm: a fixed set of ink grains stored as parallel arrays.
 *
 * x, y        position, in paper coordinates (CSS pixels from the top-left of the document)
 * vx, vy      velocity, for proofs that integrate motion
 * tx, ty      a target, for proofs that steer grains somewhere
 * sx, sy, delay, bend   the start, stagger and curve of a flight (see motion.js)
 * alpha, size, tint     how a grain is drawn; tint 0 = ink, 1 = accent
 * seed        a random constant in [0, 1) per grain
 * glyph       index of the character the grain belongs to in the current sentence, or -1
 *
 * @param {number} count
 */
export function createParticles(count) {
  const floats = () => new Float32Array(count);
  return {
    count,
    x: floats(), y: floats(), vx: floats(), vy: floats(), tx: floats(), ty: floats(),
    sx: floats(), sy: floats(), delay: floats(), bend: floats(),
    alpha: floats(), size: floats(), tint: floats(), seed: floats(),
    glyph: new Int32Array(count),
  };
}
