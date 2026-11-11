#!/usr/bin/env node
/**
 * Films the built Q.E.D. page, frame by frame, with its soundtrack.
 *
 *   node tools/capture.mjs film   [out.mp4]  [--scheme dark|light] [--width 1280] [--height 720] [--scale 1.5] [--sound out.wav]
 *   node tools/capture.mjs poster [out.png]  [--proof ink] [--at 8] [--width 1200] [--height 630] [--scale 1]
 *
 * `film` plays all seven proofs once and writes an H.264 video with AAC sound; `--sound` also
 * keeps the uncompressed soundtrack. `poster` writes a still of one proof, `--at` seconds into it.
 *
 * The page's clock is stepped by hand, so every frame is rendered in full however slow the
 * machine, and the sound is synthesised afterwards from the same events the picture was drawn
 * from. Needs Playwright with Chromium, and ffmpeg on the PATH.
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PAGE = new URL('../site/qed/index.html', import.meta.url);
const FPS = 30;
// The page is stepped at the rate of an ordinary display, so the film moves as a viewer's would.
const STEPS_PER_FRAME = 2;
const LEAD_IN = 2.5;
const LEAD_OUT = 1.6;

function options(argv) {
  const named = {};
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) named[argv[i].slice(2)] = argv[++i];
    else positional.push(argv[i]);
  }
  return { named, positional };
}

async function open({ width, height, scale, scheme }) {
  // Playwright may live outside this project (it ships its own browser), so it is resolved from
  // NODE_PATH as well as from here.
  const require = createRequire(import.meta.url);
  const { chromium } = require(require.resolve('playwright', { paths: [process.cwd(), ...(process.env.NODE_PATH ?? '').split(':')] }));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'] });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: scale, colorScheme: scheme });
  page.on('pageerror', (error) => {
    throw error;
  });
  await page.addInitScript(() => {
    window.__QED_FILM__ = true;
  });
  await page.goto(PAGE.href);
  await page.waitForFunction(() => typeof window.__QED_FILM__ === 'object');
  const advance = (frames) => page.evaluate(([n, dt]) => {
    for (let i = 0; i < n; i++) window.__QED_FILM__.clock.advance(dt);
    return window.__QED_FILM__.stage.phase;
  }, [frames * STEPS_PER_FRAME, 1 / (FPS * STEPS_PER_FRAME)]);
  return { browser, page, advance };
}

async function film(out, settings) {
  const { browser, page, advance } = await open(settings);
  const work = await mkdtemp(join(tmpdir(), 'qed-film-'));
  const silent = join(work, 'picture.mp4');
  const encoder = spawn('ffmpeg', [
    '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', silent,
  ], { stdio: ['pipe', 'inherit', 'inherit'] });

  let frames = 0;
  const shoot = async () => {
    const png = await page.screenshot({ type: 'png' });
    if (!encoder.stdin.write(png)) await once(encoder.stdin, 'drain');
    frames++;
  };

  await shoot();
  for (let i = 0; i < LEAD_IN * FPS; i++) {
    await advance(1);
    await shoot();
  }
  await page.evaluate(() => window.__QED_FILM__.director.showAll());
  for (let phase = ''; phase !== 'idle';) {
    phase = await advance(1);
    await shoot();
    if (frames % (FPS * 10) === 0) console.log(`${frames / FPS}s filmed`);
  }
  for (let i = 0; i < LEAD_OUT * FPS; i++) {
    await advance(1);
    await shoot();
  }
  encoder.stdin.end();
  await once(encoder, 'close');

  const seconds = frames / FPS;
  const sound = join(work, 'sound.wav');
  const wav = await page.evaluate(async (s) => {
    const bytes = await window.__QED_FILM__.audio.render(s);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
    return btoa(binary);
  }, seconds);
  await writeFile(sound, Buffer.from(wav, 'base64'));
  await browser.close();

  const mux = spawn('ffmpeg', [
    '-loglevel', 'error', '-y', '-i', silent, '-i', sound, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
    '-movflags', '+faststart', '-shortest', out,
  ], { stdio: 'inherit' });
  await once(mux, 'close');
  if (settings.keepSound) await writeFile(settings.keepSound, Buffer.from(wav, 'base64'));
  await rm(work, { recursive: true });
  console.log(`${out}: ${seconds.toFixed(1)}s, ${frames} frames`);
}

async function poster(out, settings) {
  const { browser, page, advance } = await open(settings);
  await advance(LEAD_IN * FPS);
  await page.click(`#${settings.proof} .demonstrate`);
  await advance(Math.round(settings.at * FPS));
  await page.screenshot({ path: out, type: 'png' });
  await browser.close();
  console.log(out);
}

const { named, positional } = options(process.argv.slice(2));
const [command, target] = positional;
const number = (name, fallback) => Number(named[name] ?? fallback);
if (command === 'film') {
  await film(target ?? fileURLToPath(new URL('../site/qed/qed.mp4', import.meta.url)), {
    width: number('width', 1280), height: number('height', 720), scale: number('scale', 1.5), scheme: named.scheme ?? 'dark', keepSound: named.sound,
  });
} else if (command === 'poster') {
  await poster(target ?? fileURLToPath(new URL('../site/qed/poster.png', import.meta.url)), {
    width: number('width', 1200), height: number('height', 630), scale: number('scale', 1), scheme: named.scheme ?? 'dark',
    proof: named.proof ?? 'ink', at: number('at', 8),
  });
} else {
  console.error('usage: capture.mjs film|poster [out] [--scheme dark|light] [--width n] [--height n] [--scale n]');
  process.exit(1);
}
