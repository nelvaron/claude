/**
 * @typedef {object} Sentence
 * @property {HTMLElement} el the element holding the sentence
 * @property {string} text the sentence, single-spaced
 * @property {import('../gfx/glyphs.js').Word[]} words one entry per word, each in its own span
 */

/**
 * @typedef {object} Proposition
 * @property {string} id
 * @property {string} act name of the proof that demonstrates it
 * @property {string} heading e.g. "Proposition 3 · Chance"
 * @property {HTMLElement} el
 * @property {Sentence} sentence
 */

/**
 * Wraps each word of an element in its own span, so that words can be measured where the
 * browser laid them out. The element's text is unchanged for readers and screen readers.
 * @param {HTMLElement} el
 * @returns {Sentence}
 */
export function splitWords(el) {
  const text = el.textContent.trim().replace(/\s+/g, ' ');
  const words = [];
  const nodes = [];
  let offset = 0;
  for (const word of text.split(' ')) {
    const span = document.createElement('span');
    span.className = 'w';
    span.textContent = word;
    if (nodes.length) nodes.push(' ');
    nodes.push(span);
    words.push({ el: span, text: word, offset });
    offset += word.length + 1;
  }
  el.replaceChildren(...nodes);
  return { el, text, words };
}

/**
 * Binds the article: its title, its propositions and the reader's exercise.
 * @param {HTMLElement} root the article element
 * @returns {{
 *   title: Sentence, propositions: Proposition[],
 *   setShift(px: number): void, setDim(amount: number): void, lock(on: boolean): void,
 *   setInk(sentence: Sentence, amount: number): void, markProved(prop: Proposition): void,
 *   exercise(text: string, act: string): Proposition,
 *   onDemonstrate(fn: (prop: Proposition) => void): void, onPlayAll(fn: () => void): void,
 *   onExercise(fn: (prop: Proposition) => void): void}}
 *   setShift slides the whole article vertically without scrolling it; setDim fades it (0 = as
 *   written, 1 = faintest); lock stops the page scrolling; setInk hides a sentence's own text by
 *   `amount` (0..1) while grains stand in for it
 */
export function bindPaper(root) {
  const title = splitWords(root.querySelector('[data-title]'));
  const propositions = Array.from(root.querySelectorAll('[data-act]:not(button)'), (el) => ({
    id: el.id,
    act: el.dataset.act,
    heading: el.dataset.heading,
    el,
    sentence: splitWords(el.querySelector('.statement')),
  }));
  const tally = root.querySelector('[data-tally]');
  const form = root.querySelector('[data-exercise]');
  const input = form.querySelector('input');
  const yours = root.querySelector('[data-yours]');
  const proved = new Set();

  return {
    title,
    propositions,
    setShift(px) {
      root.style.transform = px ? `translate3d(0, ${px.toFixed(2)}px, 0)` : '';
    },
    setDim(amount) {
      root.style.setProperty('--dim', String(1 - 0.94 * amount));
      root.classList.toggle('staged', amount > 0);
    },
    lock(on) {
      document.documentElement.classList.toggle('locked', on);
    },
    setInk(sentence, amount) {
      sentence.el.style.opacity = amount ? String(1 - amount) : '';
    },
    markProved(prop) {
      prop.el.classList.add('proved');
      if (!propositions.includes(prop)) return;
      proved.add(prop);
      tally.textContent = `${proved.size} of ${propositions.length} proved`;
    },
    exercise(text, act) {
      const statement = yours.querySelector('.statement');
      statement.textContent = text;
      yours.hidden = false;
      yours.classList.remove('proved');
      return { id: 'exercise', act, heading: `Exercise · ${act[0].toUpperCase()}${act.slice(1)}`, el: yours, sentence: splitWords(statement) };
    },
    onDemonstrate(fn) {
      for (const prop of propositions) {
        prop.el.querySelector('.demonstrate').addEventListener('click', () => fn(prop));
        prop.sentence.el.addEventListener('click', () => fn(prop));
      }
    },
    onPlayAll(fn) {
      root.querySelector('[data-play-all]').addEventListener('click', fn);
    },
    onExercise(fn) {
      form.addEventListener('submit', (event) => event.preventDefault());
      for (const button of form.querySelectorAll('button[data-act]')) {
        button.addEventListener('click', () => {
          const text = input.value.trim().replace(/\s+/g, ' ') || input.placeholder;
          fn(this.exercise(text, button.dataset.act));
        });
      }
    },
  };
}
