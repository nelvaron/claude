#!/usr/bin/env node
/**
 * Searches for an autogram: a sentence that lists how many times it uses each letter, and is right.
 *
 *   node tools/find-autogram.mjs "This sentence contains exactly" [seed]
 *
 * Prints the first sentence found for the given opening words.
 */
import { spell } from '../src/qed/js/lang/numerals.js';
import { countLetters, item, isAutogram } from '../src/qed/js/lang/autogram.js';

const opening = process.argv[2] ?? 'This sentence contains exactly';
let seed = Number(process.argv[3] ?? 1) >>> 0;

function random() {
  seed = (seed + 0x6d2b79f5) >>> 0;
  let t = seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

const MAX = 60;
const A = 97;
const fixed = countLetters(`${opening} and`);
/** Letters contributed by the spelled number n, plus the plural "s" when n ≠ 1. */
const numeral = Array.from({ length: MAX + 1 }, (_, n) => {
  const v = countLetters(spell(n));
  if (n !== 1) v['s'.charCodeAt(0) - A]++;
  return v;
});

// A letter is listed when the opening uses it or any spelled number can; each listed letter then
// occurs at least once, as its own entry.
const listed = [];
for (let l = 0; l < 26; l++) {
  if (fixed[l] > 0 || numeral.some((v) => v[l] > 0)) listed.push(l);
}

function actual(claim) {
  const counts = Int32Array.from(fixed);
  for (const l of listed) {
    counts[l]++;
    const v = numeral[claim[l]];
    for (let k = 0; k < 26; k++) counts[k] += v[k];
  }
  return counts;
}

function render(claim) {
  const items = listed.map((l) => item(claim[l], String.fromCharCode(A + l)));
  const last = items.pop();
  return `${opening} ${items.join(', ')} and ${last}.`;
}

const claim = new Int32Array(26);
for (let attempt = 1; ; attempt++) {
  for (const l of listed) claim[l] = 1 + Math.floor(random() * 30);
  for (let step = 0; step < 4000; step++) {
    const counts = actual(claim);
    let wrong = 0;
    for (const l of listed) {
      if (counts[l] === claim[l]) continue;
      wrong++;
      // Correcting every letter at once oscillates; correcting a random subset settles.
      if (counts[l] <= MAX && random() < 0.5) claim[l] = counts[l];
    }
    if (wrong === 0) {
      const sentence = render(claim);
      if (!isAutogram(sentence)) throw new Error(`search and verifier disagree: ${sentence}`);
      console.log(sentence);
      console.error(`found after ${attempt} restarts`);
      process.exit(0);
    }
  }
}
