import { easeInOut, lerp, ramp } from '../core/math.js';
import { sampleWords } from '../gfx/glyphs.js';
import { beginFlight, fly, relaxLooks } from '../gfx/motion.js';

// Seconds spent in each transition.
const INTRO = 1.7;
const GATHER = 1.15;
const SETTLE = 1.1;
const HOME = 1.25;
const STAGGER = 0.35;

// A proof the viewer is playing with keeps running, up to this many seconds in all.
const PLAY_LIMIT = 40;
// Height kept clear at the bottom of the viewport for the caption, on wide and narrow screens.
const CAPTION_ROOM = 78;
const CAPTION_ROOM_NARROW = 132;
const NARROW = 560;
// The viewer's pointer counts as present for this long after it last moved.
const POINTER_MEMORY = 2.2;

const IDLE_REACH = 84;
const IDLE_PUSH = 5200;
const IDLE_SPRING = 70;
const IDLE_DAMPING = 8;

/**
 * @typedef {object} ProofContext
 * @property {ReturnType<import('../gfx/particles.js').createParticles>} P the swarm; when the
 *   proof starts, every grain sits on the sentence
 * @property {import('../gfx/glyphs.js').Sample} home where each grain sits on the sentence
 * @property {import('../page/paper.js').Sentence} sentence
 * @property {{left: number, top: number, width: number, height: number, floor: number}} view the
 *   viewport, in paper coordinates; floor is the lowest y a proof may draw at without running
 *   under the caption
 * @property {{x: number, y: number, dx: number, dy: number, down: boolean, present: boolean}} pointer
 *   the viewer's pointer in paper coordinates, or the proof's own ghost when the viewer is away;
 *   dx/dy are its movement since the last frame
 * @property {() => number} random
 * @property {import('../audio/audio.js').Audio} audio
 * @property {ReturnType<import('./hud.js').createHud>} hud
 * @property {{current: import('../gfx/palette.js').Palette}} palette
 * @property {string} source the page's own program text
 */

/**
 * @typedef {object} Proof
 * @property {number} duration seconds
 * @property {boolean} [openEnded] true when the proof may run on while the viewer plays with it
 * @property {(dt: number, t: number) => void} update moves the grains; t is seconds since start
 * @property {(g: CanvasRenderingContext2D, t: number, fade: number) => void} [draw] draws the
 *   proof's diagram in paper coordinates; fade is the opacity, 0..1, to draw it at
 * @property {(t: number) => {x: number, y: number, down?: boolean} | null} [ghost] a pointer
 *   position to use while the viewer's own pointer is idle
 */

/**
 * @typedef {object} ProofFactory
 * @property {number} anchor where the sentence's top edge should sit while the proof runs, as a
 *   fraction of the viewport height
 * @property {(context: ProofContext) => Proof} create
 */

/**
 * Creates the stage: the state machine that owns the swarm. At rest the swarm is the page's
 * title. When a proposition is presented, the swarm flies to its sentence, becomes its ink, runs
 * the proof, re-forms the sentence, and goes on to the next one or back to the title.
 *
 * @param {object} parts
 * @param {ReturnType<import('../core/clock.js').createClock>} parts.clock
 * @param {ReturnType<import('../gfx/particles.js').createParticles>} parts.particles
 * @param {ReturnType<import('../gfx/surface.js').createSurface>} parts.surface
 * @param {{current: import('../gfx/palette.js').Palette}} parts.palette
 * @param {ReturnType<import('./pointer.js').trackPointer>} parts.pointer
 * @param {ReturnType<import('./hud.js').createHud>} parts.hud
 * @param {import('../audio/audio.js').Audio} parts.audio
 * @param {ReturnType<import('../page/paper.js').bindPaper>} parts.paper
 * @param {() => number} parts.random
 * @param {Record<string, ProofFactory>} parts.proofs
 * @param {string} parts.source
 * @param {boolean} parts.calm true to skip the opening flight, for viewers who ask for less motion
 * @returns {{present(prop: import('../page/paper.js').Proposition, next?: () => import('../page/paper.js').Proposition | null): boolean,
 *   skip(): void, phase: string}} present starts a proof and returns false when one is already
 *   running; `next` is asked for the proposition to go on to when the proof ends, and null sends
 *   the swarm home; skip ends the running proof early
 */
export function createStage({ clock, particles: P, surface, palette, pointer, hud, audio, paper, random, proofs, source, calm }) {
  let phase = 'intro';
  let elapsed = 0;
  let shift = 0;
  let shiftFrom = 0;
  let shiftTo = 0;
  let dim = 0;
  let dimFrom = 0;
  let show = null;
  let title = null;
  let rested = false;
  const hand = { x: 0, y: 0, dx: 0, dy: 0, down: false, present: false };
  let handIsViewer = false;

  const origin = () => ({ x: window.scrollX, y: window.scrollY - shift });
  const enter = (next) => {
    phase = next;
    elapsed = 0;
  };

  function sampleTitle() {
    title = sampleWords(paper.title.words, P.count, random, origin());
  }

  function begin(prop, next) {
    paper.lock(true);
    paper.setInk(paper.title, 0);
    const home = sampleWords(prop.sentence.words, P.count, random, origin());
    const factory = proofs[prop.act];
    shiftFrom = shift;
    shiftTo = factory.anchor * surface.height - home.box.top + window.scrollY;
    dimFrom = dim;
    show = { prop, home, factory, next, proof: null, bonus: 0 };
    P.glyph.set(home.glyph);
    beginFlight(P, random, STAGGER);
    hud.open(prop.heading);
    hud.sound(audio.on);
    audio.play('whoosh', { vel: 0.5, dur: 0.9 });
    enter('gather');
  }

  function startProof() {
    hand.present = false;
    const top = window.scrollY - shift;
    const floor = top + surface.height - (surface.width < NARROW ? CAPTION_ROOM_NARROW : CAPTION_ROOM);
    show.proof = show.factory.create({
      P,
      home: show.home,
      sentence: show.prop.sentence,
      view: { left: window.scrollX, top, width: surface.width, height: surface.height, floor },
      pointer: hand,
      random,
      audio,
      hud,
      palette,
      source,
    });
    enter('act');
  }

  function startSettle() {
    hud.lens(null);
    hud.progress(1);
    audio.play('swish', { level: 0 });
    audio.play('whoosh', { vel: 0.35, dur: 0.8 });
    show.proofTime = elapsed;
    beginFlight(P, random, STAGGER);
    enter('settle');
  }

  function finish() {
    const { prop, next } = show;
    for (let i = 0; i < P.count; i++) {
      P.alpha[i] = 1;
      P.size[i] = 1;
      P.tint[i] = 0;
    }
    paper.setInk(prop.sentence, 0);
    paper.markProved(prop);
    audio.play('bell', { freq: 1046.5, vel: 0.3, dur: 1.6 });
    audio.play('bell', { freq: 1568, vel: 0.2, dur: 1.8 }, 0.09);
    show = null;
    const following = next ? next() : null;
    if (following) {
      begin(following, next);
      return;
    }
    hud.close();
    sampleTitle();
    shiftFrom = shift;
    shiftTo = 0;
    dimFrom = dim;
    beginFlight(P, random, STAGGER);
    enter('home');
  }

  function followHand(t) {
    const viewer = clock.now - pointer.movedAt < POINTER_MEMORY;
    const ghost = viewer ? null : show.proof.ghost?.(t) ?? null;
    const x = viewer ? pointer.x + window.scrollX : ghost?.x;
    const y = viewer ? pointer.y + window.scrollY - shift : ghost?.y;
    const present = viewer || Boolean(ghost);
    // A hand that has just appeared, or changed owner, has not moved yet.
    const continuous = present && hand.present && viewer === handIsViewer;
    hand.dx = continuous ? x - hand.x : 0;
    hand.dy = continuous ? y - hand.y : 0;
    hand.present = present;
    hand.down = viewer ? pointer.down : Boolean(ghost && ghost.down !== false);
    if (present) {
      hand.x = x;
      hand.y = y;
    }
    handIsViewer = viewer;
    return viewer;
  }

  /** At rest the swarm is the title, and shies away from the pointer. */
  function rest(dt) {
    const px = pointer.x + window.scrollX;
    const py = pointer.y + window.scrollY;
    const near = clock.now - pointer.movedAt < 3
      && px > title.box.left - IDLE_REACH && px < title.box.right + IDLE_REACH
      && py > title.box.top - IDLE_REACH && py < title.box.bottom + IDLE_REACH;
    if (rested && !near) return;
    const damping = Math.exp(-IDLE_DAMPING * dt);
    let energy = 0;
    for (let i = 0; i < P.count; i++) {
      let ax = (title.x[i] - P.x[i]) * IDLE_SPRING;
      let ay = (title.y[i] - P.y[i]) * IDLE_SPRING;
      if (near) {
        const dx = P.x[i] - px;
        const dy = P.y[i] - py;
        const d2 = dx * dx + dy * dy;
        if (d2 < IDLE_REACH * IDLE_REACH) {
          const d = Math.sqrt(d2) + 0.5;
          const push = (1 - d / IDLE_REACH) ** 2 * IDLE_PUSH * (0.4 + 0.6 * P.seed[i]);
          ax += (dx / d) * push;
          ay += (dy / d) * push;
        }
      }
      P.vx[i] = (P.vx[i] + ax * dt) * damping;
      P.vy[i] = (P.vy[i] + ay * dt) * damping;
      P.x[i] += P.vx[i] * dt;
      P.y[i] += P.vy[i] * dt;
      energy += Math.abs(P.vx[i]) + Math.abs(P.vy[i]);
    }
    rested = !near && energy / P.count < 0.05;
  }

  function frame(dt) {
    elapsed += dt;
    let diagram = null;
    let diagramFade = 1;

    if (phase === 'intro') {
      const u = elapsed / INTRO;
      fly(P, title.x, title.y, u, STAGGER);
      const k = 1 - Math.exp(-4 * dt);
      for (let i = 0; i < P.count; i++) P.alpha[i] += (1 - P.alpha[i]) * k;
      if (u >= 1) {
        P.alpha.fill(1);
        enter('idle');
      }
    } else if (phase === 'idle') {
      rest(dt);
    } else if (phase === 'gather') {
      const u = elapsed / GATHER;
      shift = lerp(shiftFrom, shiftTo, easeInOut(ramp(u, 0, 0.75)));
      dim = lerp(dimFrom, 1, ramp(u, 0, 0.5));
      fly(P, show.home.x, show.home.y, u, STAGGER);
      relaxLooks(P, dt);
      paper.setInk(show.prop.sentence, ramp(u, 0.6, 0.95));
      if (u >= 1) startProof();
    } else if (phase === 'act') {
      const proof = show.proof;
      const viewer = followHand(elapsed);
      proof.update(dt, elapsed);
      const duration = proof.duration + show.bonus;
      if (proof.openEnded && viewer && duration - elapsed < 2.5 && elapsed < PLAY_LIMIT) show.bonus += dt;
      hud.progress(elapsed / duration);
      diagram = elapsed;
      if (elapsed >= duration) startSettle();
    } else if (phase === 'settle') {
      const u = elapsed / SETTLE;
      fly(P, show.home.x, show.home.y, u, STAGGER);
      relaxLooks(P, dt, 6);
      diagram = show.proofTime;
      diagramFade = 1 - ramp(u, 0, 0.3);
      if (u >= 1) finish();
    } else if (phase === 'home') {
      const u = elapsed / HOME;
      shift = lerp(shiftFrom, shiftTo, easeInOut(ramp(u, 0, 0.8)));
      dim = lerp(dimFrom, 0, ramp(u, 0.2, 0.9));
      fly(P, title.x, title.y, u, STAGGER);
      paper.setInk(paper.title, ramp(u, 0.7, 1));
      if (u >= 1) {
        paper.lock(false);
        rested = false;
        enter('idle');
      }
    }

    paper.setShift(shift);
    paper.setDim(dim);
    const offsetX = window.scrollX;
    const offsetY = window.scrollY - shift;
    surface.beginDecor(offsetX, offsetY);
    if (diagram !== null && diagramFade > 0 && show?.proof?.draw) show.proof.draw(surface.decor, diagram, diagramFade);
    surface.renderer.draw(P, { offsetX, offsetY, ink: palette.current.ink, accent: palette.current.accent, glow: palette.current.glow });
  }

  sampleTitle();
  paper.setInk(paper.title, 1);
  for (let i = 0; i < P.count; i++) {
    P.seed[i] = random();
    P.size[i] = 1;
    P.glyph[i] = -1;
    if (calm) {
      P.x[i] = title.x[i];
      P.y[i] = title.y[i];
      P.alpha[i] = 1;
    } else {
      const angle = random() * Math.PI * 2;
      const reach = (0.25 + random()) * Math.max(surface.width, surface.height) * 0.7;
      P.x[i] = title.x[i] + Math.cos(angle) * reach;
      P.y[i] = title.y[i] + Math.sin(angle) * reach * 0.6;
      P.alpha[i] = 0;
    }
  }
  beginFlight(P, random, STAGGER);
  if (calm) enter('idle');

  surface.onResize(() => {
    if (phase !== 'idle' && phase !== 'intro') return;
    sampleTitle();
    rested = false;
  });
  clock.onFrame(frame);

  return {
    present(prop, next = null) {
      if (phase === 'gather' || phase === 'act' || phase === 'settle') return false;
      begin(prop, next);
      return true;
    },
    skip() {
      if (phase === 'act') startSettle();
    },
    get phase() {
      return phase;
    },
  };
}
