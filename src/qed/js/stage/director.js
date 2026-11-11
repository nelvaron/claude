/**
 * Creates the director, which decides what the stage shows next: one proof on request, or all
 * of them in order.
 * @param {ReturnType<import('./stage.js').createStage>} stage
 * @param {import('../page/paper.js').Proposition[]} propositions
 * @returns {{show(prop: import('../page/paper.js').Proposition): void, showAll(): void,
 *   stop(): void}} stop ends the running proof and cancels any that were queued behind it
 */
export function createDirector(stage, propositions) {
  let queue = [];
  const next = () => queue.shift() ?? null;
  return {
    show(prop) {
      queue = [];
      stage.present(prop, next);
    },
    showAll() {
      if (stage.phase !== 'idle' && stage.phase !== 'intro' && stage.phase !== 'home') return;
      queue = propositions.slice(1);
      stage.present(propositions[0], next);
    },
    stop() {
      queue = [];
      stage.skip();
    },
  };
}
