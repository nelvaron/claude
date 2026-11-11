import { PROOFS } from './acts/index.js';
import { createAudio, createAudioRecorder } from './audio/audio.js';
import { createClock } from './core/clock.js';
import { createRandom } from './core/random.js';
import { createParticles } from './gfx/particles.js';
import { watchPalette } from './gfx/palette.js';
import { createSurface } from './gfx/surface.js';
import { bindPaper } from './page/paper.js';
import { createDirector } from './stage/director.js';
import { createHud } from './stage/hud.js';
import { trackPointer } from './stage/pointer.js';
import { createStage } from './stage/stage.js';

const GRAINS = 44000;
const GRAINS_SMALL = 24000;
const FACES = ['500 1em "QED Serif"', 'italic 500 1em "QED Serif"', '700 1em "QED Serif"', '1em "QED Mono"'];

async function start() {
  // Grains are placed by measuring set text, so the faces must be in before anything is measured.
  await Promise.all(FACES.map((face) => document.fonts.load(face))).catch(() => {});

  // A film crew (tools/capture.mjs) sets this before the page loads, to drive time by hand and
  // collect the soundtrack.
  const filming = Boolean(window.__QED_FILM__);
  const clock = createClock({ manual: filming });
  const audio = filming ? createAudioRecorder(clock) : createAudio();
  const surface = createSurface(document.getElementById('decor'), document.getElementById('grains'), { keepFrames: filming });
  const small = Math.min(surface.width, surface.height) < 560 || !surface.renderer.accelerated;
  const paper = bindPaper(document.getElementById('paper'));
  const hud = createHud(document.getElementById('hud'));

  const stage = createStage({
    clock,
    audio,
    surface,
    paper,
    hud,
    particles: createParticles(small ? GRAINS_SMALL : GRAINS),
    palette: watchPalette(),
    pointer: trackPointer(clock),
    random: createRandom(1729),
    proofs: PROOFS,
    source: document.getElementById('program').textContent.trim(),
    calm: matchMedia('(prefers-reduced-motion: reduce)').matches,
  });
  const director = createDirector(stage, paper.propositions);

  const withSound = (action) => (...args) => {
    audio.unlock();
    action(...args);
  };
  paper.onDemonstrate(withSound(director.show));
  paper.onExercise(withSound(director.show));
  paper.onPlayAll(withSound(director.showAll));
  hud.onSkip(() => stage.skip());
  hud.onSound(() => hud.sound(audio.toggle()));
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') director.stop();
  });

  clock.start();
  if (filming) window.__QED_FILM__ = { clock, audio, director, stage };
}

start();
