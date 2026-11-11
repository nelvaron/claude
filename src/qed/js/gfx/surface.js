import { createRenderer } from './renderer.js';

// Beyond this the extra pixels cost more than they show.
const MAX_DPR = 2;

/**
 * Sets up the two fixed canvases that cover the viewport: `decor` for a proof's diagrams (drawn
 * with the 2D API) and `grains` for the swarm on top of it.
 * @param {HTMLCanvasElement} decorCanvas
 * @param {HTMLCanvasElement} grainCanvas
 * @param {{keepFrames?: boolean}} [options] keepFrames is passed to the grain renderer
 * @returns {{width: number, height: number, renderer: ReturnType<typeof createRenderer>,
 *   decor: CanvasRenderingContext2D, beginDecor(offsetX: number, offsetY: number): void,
 *   onResize(fn: () => void): void}} width/height are the viewport in CSS pixels; beginDecor
 *   clears the diagram layer and sets it up to be drawn in paper coordinates
 */
export function createSurface(decorCanvas, grainCanvas, { keepFrames = false } = {}) {
  const renderer = createRenderer(grainCanvas, keepFrames);
  const decor = decorCanvas.getContext('2d');
  const listeners = [];
  const surface = {
    width: 0,
    height: 0,
    renderer,
    decor,
    beginDecor(offsetX, offsetY) {
      const dpr = decorCanvas.width / Math.max(1, surface.width);
      decor.setTransform(1, 0, 0, 1, 0, 0);
      decor.clearRect(0, 0, decorCanvas.width, decorCanvas.height);
      decor.setTransform(dpr, 0, 0, dpr, -offsetX * dpr, -offsetY * dpr);
    },
    onResize(fn) {
      listeners.push(fn);
    },
  };

  function fit() {
    const width = grainCanvas.clientWidth;
    const height = grainCanvas.clientHeight;
    if (width === surface.width && height === surface.height) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    for (const canvas of [decorCanvas, grainCanvas]) {
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    }
    surface.width = width;
    surface.height = height;
    renderer.resize(width, height, dpr);
    listeners.forEach((fn) => fn());
  }

  fit();
  // The canvas box changes without a window resize when a scrollbar appears or goes.
  new ResizeObserver(fit).observe(grainCanvas);
  return surface;
}
