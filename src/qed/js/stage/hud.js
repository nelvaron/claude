/**
 * Binds the overlay shown while a proof runs: its heading, a large readout, a caption, a code
 * lens, a progress line, and the skip and sound controls.
 * @param {HTMLElement} root the overlay element
 * @returns {{
 *   open(heading: string): void, close(): void,
 *   caption(text: string): void, readout(text: string): void, progress(fraction: number): void,
 *   lens(view: {lines: string[], first: number, focus: number, x: number, y: number} | null): void,
 *   sound(on: boolean): void,
 *   onSkip(fn: () => void): void, onSound(fn: () => void): void}}
 *   lens takes viewport coordinates and shows source lines numbered from `first` (1-based), with
 *   the line at index `focus` highlighted; null hides it
 */
export function createHud(root) {
  const part = (name) => root.querySelector(`[data-hud="${name}"]`);
  const heading = part('heading');
  const caption = part('caption');
  const readout = part('readout');
  const bar = part('progress');
  const lens = part('lens');
  const skip = part('skip');
  const sound = part('sound');
  const text = (element, value) => {
    if (element.textContent !== value) element.textContent = value;
  };

  return {
    open(title) {
      text(heading, title);
      text(caption, '');
      text(readout, '');
      lens.hidden = true;
      bar.style.transform = 'scaleX(0)';
      root.hidden = false;
    },
    close() {
      root.hidden = true;
    },
    caption: (value) => text(caption, value),
    readout: (value) => text(readout, value),
    progress(fraction) {
      bar.style.transform = `scaleX(${Math.min(1, Math.max(0, fraction)).toFixed(4)})`;
    },
    lens(view) {
      lens.hidden = !view;
      if (!view) return;
      lens.replaceChildren(...view.lines.map((line, i) => {
        const row = document.createElement('span');
        row.className = i === view.focus ? 'row focus' : 'row';
        row.dataset.n = String(view.first + i);
        row.textContent = line || ' ';
        return row;
      }));
      const margin = 12;
      // Room kept clear at the bottom for the caption.
      const footer = 84;
      const box = lens.getBoundingClientRect();
      const x = Math.min(Math.max(margin, view.x + 18), root.clientWidth - box.width - margin);
      const below = view.y + 22;
      const y = below + box.height + footer > root.clientHeight ? view.y - box.height - 22 : below;
      lens.style.transform = `translate(${Math.round(x)}px, ${Math.round(Math.max(margin, y))}px)`;
    },
    sound(on) {
      text(sound, on ? 'Sound on' : 'Sound off');
      sound.setAttribute('aria-pressed', String(on));
    },
    onSkip: (fn) => skip.addEventListener('click', fn),
    onSound: (fn) => sound.addEventListener('click', fn),
  };
}
