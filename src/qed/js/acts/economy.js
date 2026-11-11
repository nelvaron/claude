import { clamp, easeInOut, ramp } from '../core/math.js';

const START = 0.4;
const WRITE = 3.8;
const FLIGHT = 0.7;
const LENS_FROM = START + WRITE + 0.6;
const LENS_LINES = 4;
const LONGEST = 110;

/**
 * Proof of economy: lays the page's whole program out as a map, one row per line of code, and
 * lets the viewer read any part of it through a lens.
 * @type {import('../stage/stage.js').ProofFactory}
 */
export const economy = {
  anchor: 0.085,
  create({ P, home, view, pointer, source, audio, hud }) {
    const N = P.count;
    const lines = source.split('\n');
    const L = lines.length;

    // Columns of rows, as many as are needed to fit every line between the sentence and the caption.
    const top = home.box.bottom + 26;
    const bottom = view.floor;
    const margin = Math.max(18, (view.width - 1180) / 2);
    const left = view.left + margin;
    const width = view.width - margin * 2;
    const pitch = clamp((bottom - top) / Math.ceil(L / Math.max(2, Math.floor(width / 120))), 1.35, 2.6);
    const perColumn = Math.max(1, Math.floor((bottom - top) / pitch));
    const columns = Math.ceil(L / perColumn);
    const gap = 10;
    const columnWidth = (width - gap * (columns - 1)) / columns;
    const charWidth = columnWidth / LONGEST;

    // Every character that is not blank, in file order.
    const inkLine = [];
    const inkColumn = [];
    lines.forEach((line, n) => {
      const end = Math.min(line.length, LONGEST);
      for (let c = 0; c < end; c++) {
        if (line.charCodeAt(c) > 32) {
          inkLine.push(n);
          inkColumn.push(c);
        }
      }
    });
    const characters = source.replace(/\s/g, '').length;

    const line = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      const k = Math.floor(((i + P.seed[i]) / N) * inkLine.length);
      line[i] = inkLine[k];
      P.tx[i] = left + Math.floor(line[i] / perColumn) * (columnWidth + gap) + (inkColumn[k] + P.seed[i]) * charWidth;
      P.ty[i] = top + (line[i] % perColumn) * pitch + ((i * 7919) % 11) / 11 * Math.min(1, pitch - 0.6);
    }

    const lineAt = (x, y) => {
      const column = Math.floor((x - left) / (columnWidth + gap));
      const row = Math.floor((y - top) / pitch);
      if (column < 0 || column >= columns || row < 0 || row >= perColumn) return -1;
      const n = column * perColumn + row;
      return n < L ? n : -1;
    };
    let focus = -1;
    let ticked = 0;

    return {
      duration: LENS_FROM + 5.6,
      openEnded: true,
      ghost(t) {
        if (t < LENS_FROM) return null;
        // Reads down the file, column by column.
        const n = Math.floor(easeInOut(ramp(t, LENS_FROM, LENS_FROM + 5)) * (L - 1));
        return {
          x: left + Math.floor(n / perColumn) * (columnWidth + gap) + columnWidth * 0.35,
          y: top + (n % perColumn) * pitch,
        };
      },
      update(dt, t) {
        const written = Math.floor(ramp(t, START, START + WRITE) * L);
        if (written > ticked && t - START < WRITE) {
          audio.play('tick', { freq: 1500 + 700 * (written / L), vel: 0.3 });
          ticked = written + L / 60;
        }
        hud.readout(`${written.toLocaleString('en')} lines`);

        focus = t >= LENS_FROM && pointer.present ? lineAt(pointer.x, pointer.y) : -1;
        if (focus >= 0) {
          const first = clamp(focus - LENS_LINES, 0, Math.max(0, L - 2 * LENS_LINES - 1));
          hud.lens({
            lines: lines.slice(first, first + 2 * LENS_LINES + 1).map((text) => text.slice(0, 96)),
            first: first + 1,
            focus: focus - first,
            x: pointer.x - view.left,
            y: pointer.y - view.top,
          });
        } else {
          hud.lens(null);
        }
        hud.caption(t < LENS_FROM
          ? 'Every line of the program that is drawing this, as it was written.'
          : `${characters.toLocaleString('en')} characters, 0 libraries, 0 images. Point at any part to read it.`);

        for (let i = 0; i < N; i++) {
          const e = easeInOut(ramp(t, START + (line[i] / L) * WRITE, START + (line[i] / L) * WRITE + FLIGHT));
          P.x[i] = home.x[i] + (P.tx[i] - home.x[i]) * e;
          P.y[i] = home.y[i] + (P.ty[i] - home.y[i]) * e;
          const near = focus >= 0 && Math.abs(line[i] - focus) <= LENS_LINES;
          P.tint[i] = near ? 1 : Math.sin(Math.PI * e) * 0.8;
          P.size[i] = near ? 1.25 : 1 - 0.28 * e;
          P.alpha[i] = 1 - 0.25 * e;
        }
      },
    };
  },
};
