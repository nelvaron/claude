// Text is rasterised at this multiple of CSS pixels before it is turned into grains.
const SCALE = 2;
const PAD = 6;
const INK_THRESHOLD = 150;

const scratch = document.createElement('canvas');
const g = scratch.getContext('2d', { willReadFrequently: true });

/** Canvas font shorthand matching how an element's text is set. */
export function fontOf(element) {
  const style = getComputedStyle(element);
  return `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
}

function prepare(left, top, width, height, font) {
  scratch.width = Math.ceil((width + PAD * 2) * SCALE);
  scratch.height = Math.ceil((height + PAD * 2) * SCALE);
  g.setTransform(SCALE, 0, 0, SCALE, (PAD - left) * SCALE, (PAD - top) * SCALE);
  g.font = font;
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#000';
}

/**
 * Spreads `count` grains evenly over a list of inked pixels, keeping the list's order: grain i
 * lands near position i / count of the list.
 */
function scatter(pixels, count, random, left, top) {
  const x = new Float32Array(count);
  const y = new Float32Array(count);
  const glyph = new Int32Array(count).fill(-1);
  const total = pixels.x.length;
  for (let i = 0; i < count && total > 0; i++) {
    const p = Math.min(total - 1, Math.floor(((i + random()) / count) * total));
    x[i] = left - PAD + (pixels.x[p] + random()) / SCALE;
    y[i] = top - PAD + (pixels.y[p] + random()) / SCALE;
    if (pixels.glyph) glyph[i] = pixels.glyph[p];
  }
  return { x, y, glyph };
}

/**
 * @typedef {object} Word
 * @property {HTMLElement} el the element that holds exactly this word
 * @property {string} text
 * @property {number} offset index of the word's first character in its sentence
 */

/**
 * @typedef {object} Sample
 * @property {Float32Array} x grain positions, paper coordinates
 * @property {Float32Array} y
 * @property {Int32Array} glyph character index per grain, -1 when unknown
 * @property {{left: number, top: number, right: number, bottom: number}} box bounds of the text
 */

/**
 * Turns words that are laid out in the document into grain positions that sit exactly on their
 * ink. Grains come back in reading order and know which character they belong to.
 * @param {Word[]} words
 * @param {number} count how many grains to place
 * @param {() => number} random
 * @param {{x: number, y: number}} origin added to viewport coordinates to get paper coordinates
 * @returns {Sample}
 */
export function sampleWords(words, count, random, origin) {
  const rects = words.map((word) => word.el.getBoundingClientRect());
  const left = Math.min(...rects.map((r) => r.left));
  const top = Math.min(...rects.map((r) => r.top));
  const right = Math.max(...rects.map((r) => r.right));
  const bottom = Math.max(...rects.map((r) => r.bottom));

  prepare(left, top, right - left, bottom - top, fontOf(words[0].el));
  const ascent = g.measureText('Hg').fontBoundingBoxAscent;
  words.forEach((word, i) => g.fillText(word.text, rects[i].left, rects[i].top + ascent));
  const image = g.getImageData(0, 0, scratch.width, scratch.height);

  const pixels = { x: [], y: [], glyph: [] };
  words.forEach((word, i) => {
    const rect = rects[i];
    const ends = Array.from(word.text, (_, c) => g.measureText(word.text.slice(0, c + 1)).width);
    const x0 = Math.max(0, Math.floor((rect.left - left + PAD - 1) * SCALE));
    const x1 = Math.min(scratch.width, Math.ceil((rect.right - left + PAD + 2) * SCALE));
    const y0 = Math.max(0, Math.floor((rect.top - top + PAD) * SCALE));
    const y1 = Math.min(scratch.height, Math.ceil((rect.bottom - top + PAD) * SCALE));
    let c = 0;
    // Column by column, so the pixel list (and the grains made from it) runs in reading order.
    for (let px = x0; px < x1; px++) {
      const within = px / SCALE - PAD + left - rect.left;
      while (c < ends.length - 1 && within > ends[c]) c++;
      for (let py = y0; py < y1; py++) {
        if (image.data[(py * scratch.width + px) * 4 + 3] < INK_THRESHOLD) continue;
        pixels.x.push(px);
        pixels.y.push(py);
        pixels.glyph.push(word.offset + c);
      }
    }
  });

  const sample = scatter(pixels, count, random, left + origin.x, top + origin.y);
  return { ...sample, box: { left: left + origin.x, top: top + origin.y, right: right + origin.x, bottom: bottom + origin.y } };
}

function wrap(text, width) {
  const spaced = text.includes(' ');
  const units = spaced ? text.split(' ') : Array.from(text);
  const joint = spaced ? ' ' : '';
  const lines = [];
  let line = '';
  for (const unit of units) {
    const attempt = line ? line + joint + unit : unit;
    // Closing punctuation stays with the character before it, as in Chinese and Japanese setting.
    if (line && g.measureText(attempt).width > width && !/^[。、．，！？」』）]/.test(unit)) {
      lines.push(line);
      line = unit;
    } else {
      line = attempt;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * Sets a text in a column, as a browser would, and turns it into grain positions. Grains come
 * back ordered left to right across the whole block.
 * @param {string} text
 * @param {{font: string, left: number, top: number, width: number, lineHeight: number,
 *   rtl?: boolean}} column font is a canvas font shorthand; left/top/width are paper coordinates
 * @param {number} count
 * @param {() => number} random
 * @returns {{x: Float32Array, y: Float32Array}}
 */
export function sampleText(text, column, count, random) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = column.font;
  const lines = wrap(text, column.width);
  prepare(column.left, column.top, column.width, lines.length * column.lineHeight, column.font);
  g.direction = column.rtl ? 'rtl' : 'ltr';
  g.textAlign = column.rtl ? 'right' : 'left';
  const ascent = g.measureText('Hg').fontBoundingBoxAscent;
  lines.forEach((line, i) => {
    g.fillText(line, column.rtl ? column.left + column.width : column.left, column.top + ascent + i * column.lineHeight);
  });
  g.direction = 'ltr';
  g.textAlign = 'left';

  const image = g.getImageData(0, 0, scratch.width, scratch.height);
  const pixels = { x: [], y: [] };
  for (let px = 0; px < scratch.width; px++) {
    for (let py = 0; py < scratch.height; py++) {
      if (image.data[(py * scratch.width + px) * 4 + 3] < INK_THRESHOLD) continue;
      pixels.x.push(px);
      pixels.y.push(py);
    }
  }
  const { x, y } = scatter(pixels, count, random, column.left, column.top);
  return { x, y };
}
