// A hidden tab can stall for minutes; one frame never advances further than this.
const MAX_STEP = 1 / 20;

/**
 * Creates the page's single source of time. Everything that moves reads this clock, so the page
 * can be stepped frame by frame when it is filmed.
 * @param {{manual?: boolean}} [options] manual: time only moves when advance() is called
 * @returns {{now: number, onFrame(fn: (dt: number, now: number) => void): () => void,
 *   start(): void, advance(seconds: number): void}}
 */
export function createClock({ manual = false } = {}) {
  const listeners = new Set();
  let now = 0;
  let last = 0;

  function tick(dt) {
    now += dt;
    for (const listener of [...listeners]) listener(dt, now);
  }

  function loop(timestamp) {
    const dt = Math.min((timestamp - last) / 1000, MAX_STEP);
    last = timestamp;
    if (dt > 0) tick(dt);
    requestAnimationFrame(loop);
  }

  return {
    get now() {
      return now;
    },
    onFrame(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (manual) return;
      last = performance.now();
      requestAnimationFrame(loop);
    },
    advance: tick,
  };
}
