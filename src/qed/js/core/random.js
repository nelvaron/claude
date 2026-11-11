/**
 * Creates a seeded pseudo-random generator (mulberry32), so every run of a proof plays out the
 * same way and a captured film matches the live page.
 * @param {number} seed
 * @returns {{(): number, bits(): number}} call it for a float in [0, 1); bits() gives 32 random bits
 */
export function createRandom(seed) {
  let state = seed >>> 0;
  const bits = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  const random = () => bits() / 4294967296;
  random.bits = bits;
  return random;
}
