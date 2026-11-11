const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/**
 * Spells a whole number in English words.
 * @param {number} n integer in 0..99
 * @returns {string} e.g. 28 → "twenty-eight"
 * @throws {RangeError} outside 0..99
 */
export function spell(n) {
  if (!Number.isInteger(n) || n < 0 || n > 99) throw new RangeError(`cannot spell ${n}`);
  if (n < 20) return ONES[n];
  const unit = n % 10;
  return unit ? `${TENS[Math.floor(n / 10)]}-${ONES[unit]}` : TENS[n / 10];
}

const VALUE = new Map(Array.from({ length: 100 }, (_, n) => [spell(n), n]));

/**
 * Reads a number spelled by {@link spell}.
 * @param {string} words e.g. "twenty-eight"
 * @returns {number} the value, or NaN when the words are not a spelled number in 0..99
 */
export function unspell(words) {
  return VALUE.get(words.toLowerCase()) ?? NaN;
}
