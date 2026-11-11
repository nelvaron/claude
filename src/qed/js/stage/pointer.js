/**
 * Follows the viewer's mouse, pen or finger.
 * @param {{now: number}} clock
 * @returns {{x: number, y: number, down: boolean, movedAt: number}} x/y are viewport coordinates;
 *   movedAt is the clock time of the last movement or press, -Infinity before the first
 */
export function trackPointer(clock) {
  const pointer = { x: 0, y: 0, down: false, movedAt: -Infinity };
  const move = (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    pointer.movedAt = clock.now;
  };
  window.addEventListener('pointermove', move, { passive: true });
  window.addEventListener('pointerdown', (event) => {
    pointer.down = true;
    move(event);
  }, { passive: true });
  const release = () => {
    pointer.down = false;
  };
  window.addEventListener('pointerup', release, { passive: true });
  window.addEventListener('pointercancel', release, { passive: true });
  return pointer;
}
