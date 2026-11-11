import { spell, unspell } from './numerals.js';

const A = 'a'.charCodeAt(0);

/**
 * Counts the letters of a text, ignoring case and everything that is not a–z.
 * @param {string} text
 * @returns {Int32Array} 26 counts, index 0 = a
 */
export function countLetters(text) {
  const counts = new Int32Array(26);
  for (const ch of text.toLowerCase()) {
    const i = ch.charCodeAt(0) - A;
    if (i >= 0 && i < 26) counts[i]++;
  }
  return counts;
}

/**
 * Writes one inventory item the way an autogram lists it.
 * @param {number} n how many
 * @param {string} letter a single letter
 * @returns {string} "one z", "three a’s"
 */
export function item(n, letter) {
  return `${spell(n)} ${letter}${n === 1 ? '' : '’s'}`;
}

/**
 * Finds every claim of the form "<number> <letter>" or "<number> <letter>’s" in a sentence.
 * @param {string} text
 * @returns {{letter: string, claimed: number, start: number, end: number}[]} one entry per claim,
 *   in reading order; start/end delimit the spelled number within the text
 */
export function readClaims(text) {
  const claims = [];
  const pattern = /([a-z]+(?:-[a-z]+)?) ([a-z])(?:[’']s)?(?![a-z])/gi;
  for (const m of text.matchAll(pattern)) {
    const claimed = unspell(m[1]);
    if (Number.isNaN(claimed)) continue;
    claims.push({ letter: m[2].toLowerCase(), claimed, start: m.index, end: m.index + m[1].length });
  }
  return claims;
}

/**
 * Checks a self-describing sentence against itself.
 * @param {string} text
 * @returns {{letter: string, claimed: number, actual: number, start: number, end: number,
 *   positions: number[]}[]} every claim with the true count of its letter and the index of each
 *   occurrence of that letter in the text
 */
export function audit(text) {
  const lower = text.toLowerCase();
  return readClaims(text).map((claim) => {
    const positions = [];
    for (let i = 0; i < lower.length; i++) if (lower[i] === claim.letter) positions.push(i);
    return { ...claim, actual: positions.length, positions };
  });
}

/**
 * Tells whether a sentence is a true autogram: every letter it uses is claimed, and every claim
 * matches the real count.
 * @param {string} text
 * @returns {boolean}
 */
export function isAutogram(text) {
  const counts = countLetters(text);
  const claimed = new Int32Array(26);
  for (const c of readClaims(text)) claimed[c.letter.charCodeAt(0) - A] = c.claimed;
  return counts.every((n, i) => n === claimed[i]);
}
