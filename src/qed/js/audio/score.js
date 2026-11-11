// Letters from most to least common in English. Dealing the five notes of the pentatonic scale
// out in this order shares them evenly over the letters a sentence actually uses.
const BY_FREQUENCY = 'etaoinshrdlcumwfgypbvkjxqz';
const PENTATONIC = [0, 2, 4, 7, 9];
const DEAL = [0, 2, 4, 1, 3];

const LOWEST = 62;
const HIGHEST = 86;
const CENTRE = 74;

/** Sixteenth notes per chord. */
export const BAR = 8;
/** Seconds per sixteenth note. */
export const STEP = 0.132;

const CHORDS = [
  { name: 'C', root: 0, tones: [0, 4, 7] },
  { name: 'Dm', root: 2, tones: [2, 5, 9] },
  { name: 'Em', root: 4, tones: [4, 7, 11] },
  { name: 'F', root: 5, tones: [5, 9, 0] },
  { name: 'G', root: 7, tones: [7, 11, 2] },
  { name: 'Am', root: 9, tones: [9, 0, 4] },
];
// Chord changes that sound like they are going somewhere.
const LEADS_TO = { C: ['Am', 'F', 'G', 'Em'], Dm: ['G', 'Em'], Em: ['Am', 'F'], F: ['G', 'C', 'Dm'], G: ['C', 'Am', 'Em'], Am: ['F', 'Dm', 'G'] };

const pitchClassOf = (letter) => PENTATONIC[DEAL[BY_FREQUENCY.indexOf(letter) % DEAL.length]];

/** Frequency in Hz of a MIDI note number. */
export const hertz = (midi) => 440 * 2 ** ((midi - 69) / 12);

/**
 * Reads a sentence as a melody. Each letter is one sixteenth note in C major pentatonic; a
 * word's last letter rings through the space after it; punctuation is a rest.
 * @param {string} text
 * @returns {{notes: {index: number, step: number, length: number, midi: number, accent: boolean}[],
 *   steps: number}} index is the letter's position in the text, step its start in sixteenths
 */
export function melodyOf(text) {
  const notes = [];
  let step = 0;
  let previous = CENTRE;
  let wordStart = true;
  Array.from(text.toLowerCase()).forEach((ch, index) => {
    if (BY_FREQUENCY.includes(ch)) {
      const pc = pitchClassOf(ch);
      // Take the octave that moves least, with a slight pull back to the middle of the range.
      let midi = previous;
      let best = Infinity;
      for (let candidate = pc + 48; candidate <= HIGHEST; candidate += 12) {
        if (candidate < LOWEST) continue;
        const cost = Math.abs(candidate - previous) + 0.2 * Math.abs(candidate - CENTRE);
        if (cost < best) {
          best = cost;
          midi = candidate;
        }
      }
      notes.push({ index, step, length: 1, midi, accent: wordStart });
      previous = midi;
      wordStart = false;
      step += 1;
    } else if (ch === ' ') {
      if (notes.length) notes[notes.length - 1].length += 1;
      wordStart = true;
      step += 1;
    } else {
      wordStart = true;
      step += 2;
    }
  });
  return { notes, steps: step };
}

/**
 * Chooses a chord for every bar of a melody: the progression that best fits the notes while
 * moving in a way the ear expects, found by dynamic programming over all progressions. A closing
 * bar on the home chord is appended.
 * @param {ReturnType<typeof melodyOf>} melody
 * @returns {{name: string, root: number, tones: number[]}[]} one chord per bar; root and tones
 *   are pitch classes, 0 = C
 */
export function harmonise(melody) {
  const bars = Math.ceil(melody.steps / BAR);
  const fit = Array.from({ length: bars }, () => new Float64Array(CHORDS.length));
  const weight = new Float64Array(bars);
  for (const note of melody.notes) {
    const bar = Math.floor(note.step / BAR);
    const w = note.length * (note.step % 4 === 0 ? 1.4 : 1);
    weight[bar] += w;
    CHORDS.forEach((chord, c) => {
      if (chord.tones.includes(note.midi % 12)) fit[bar][c] += w;
    });
  }

  const local = (bar, c) => {
    let score = weight[bar] ? (3 * fit[bar][c]) / weight[bar] : 0;
    if (bar === 0 && CHORDS[c].name === 'C') score += 1;
    if (bar === bars - 1 && (CHORDS[c].name === 'G' || CHORDS[c].name === 'F')) score += 0.8;
    return score;
  };
  const step = (from, to) => (from === to ? -1.6 : LEADS_TO[CHORDS[from].name].includes(CHORDS[to].name) ? 0.9 : 0);

  let best = CHORDS.map((_, c) => local(0, c));
  const back = [];
  for (let bar = 1; bar < bars; bar++) {
    const next = new Float64Array(CHORDS.length);
    const from = new Int32Array(CHORDS.length);
    for (let c = 0; c < CHORDS.length; c++) {
      let top = -Infinity;
      for (let p = 0; p < CHORDS.length; p++) {
        const score = best[p] + step(p, c);
        if (score > top) {
          top = score;
          from[c] = p;
        }
      }
      next[c] = top + local(bar, c);
    }
    back.push(from);
    best = next;
  }

  let c = best.indexOf(Math.max(...best));
  const chosen = [c];
  for (let bar = back.length - 1; bar >= 0; bar--) {
    c = back[bar][c];
    chosen.unshift(c);
  }
  return [...chosen.map((i) => CHORDS[i]), CHORDS[0]];
}
