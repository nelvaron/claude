const triplet = (style, name) => style.getPropertyValue(name).trim().split(/\s+/).map(Number);

/**
 * @typedef {object} Palette
 * @property {number[]} ink rgb of the grains, each 0..1
 * @property {number[]} accent rgb of highlighted grains, each 0..1
 * @property {number} glow 0 when grains cover like ink, towards 1 when they add up like chalk
 * @property {(alpha?: number) => string} inkCss CSS colour of the ink at an opacity
 * @property {(alpha?: number) => string} accentCss CSS colour of the accent at an opacity
 */

function read() {
  const style = getComputedStyle(document.documentElement);
  const ink = triplet(style, '--ink-rgb');
  const accent = triplet(style, '--accent-rgb');
  return {
    ink: ink.map((c) => c / 255),
    accent: accent.map((c) => c / 255),
    glow: Number(style.getPropertyValue('--glow')) || 0,
    inkCss: (alpha = 1) => `rgb(${ink.join(' ')} / ${alpha})`,
    accentCss: (alpha = 1) => `rgb(${accent.join(' ')} / ${alpha})`,
  };
}

/**
 * Reads the page's colour tokens for the canvases and keeps them current when the viewer's theme
 * changes, whether through the operating system or a data-theme attribute on the root element.
 * @returns {{current: Palette}}
 */
export function watchPalette() {
  const holder = { current: read() };
  const refresh = () => {
    holder.current = read();
  };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', refresh);
  new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return holder;
}
