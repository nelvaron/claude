#!/usr/bin/env node
/**
 * Builds the Q.E.D. page from src/qed into single self-contained files:
 *
 *   site/qed/index.html        the page as a complete document, for the website
 *   build/qed.artifact.html    the same page without a document shell, for hosts that supply one
 *
 * The program is bundled but not minified, because the page shows its own code to the viewer.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { build } from 'esbuild';
import { isAutogram } from '../src/qed/js/lang/autogram.js';

const SRC = new URL('../src/qed/', import.meta.url);
const read = (path) => readFile(new URL(path, SRC), 'utf8');

const FACES = [
  ['QED Serif', 500, 'normal', 'serif-roman.woff2'],
  ['QED Serif', 500, 'italic', 'serif-italic.woff2'],
  ['QED Serif', 700, 'normal', 'serif-bold.woff2'],
  ['QED Mono', 500, 'normal', 'mono.woff2'],
];

const TITLE = 'Don’t Take My Word for It';
const DESCRIPTION = 'Seven sentences that prove themselves while you watch. One file, no libraries, written by Claude from a single prompt.';
const HOME = 'https://claude.nelvaron.xyz/qed/';

async function fontFaces() {
  const rules = await Promise.all(FACES.map(async ([family, weight, style, file]) => {
    const data = (await readFile(new URL(`fonts/${file}`, SRC))).toString('base64');
    return `@font-face{font-family:"${family}";font-weight:${weight};font-style:${style};font-display:block;src:url(data:font/woff2;base64,${data}) format("woff2")}`;
  }));
  return rules.join('\n');
}

async function program() {
  const result = await build({
    entryPoints: [new URL('js/main.js', SRC).pathname],
    bundle: true,
    format: 'iife',
    target: 'es2020',
    charset: 'utf8',
    write: false,
  });
  const code = result.outputFiles[0].text.trim();
  if (/<\/script/i.test(code)) throw new Error('the program contains a closing script tag and cannot be inlined');
  return code;
}

const [fonts, styles, markup, code] = await Promise.all([fontFaces(), read('styles.css'), read('page.html'), program()]);
const lines = code.split('\n').length;

// The page promises that its propositions are true, so one that can be checked here is.
const exactness = markup.match(/id="exactness"[\s\S]*?<span class="statement">([^<]+)<\/span>/)?.[1];
if (!exactness || !isAutogram(exactness)) throw new Error('the Exactness proposition does not describe itself correctly');
const body = markup.replaceAll('{{LINES}}', lines.toLocaleString('en'));
const style = `<style>\n${fonts}\n${styles}</style>`;
const script = `<script id="program">\n${code}\n</script>`;

const document = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
<meta property="og:type" content="website">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:url" content="${HOME}">
<meta property="og:image" content="${HOME}poster.png">
<meta name="twitter:card" content="summary_large_image">
${style}
</head>
<body>
${body}
${script}
</body>
</html>
`;

const artifact = `<title>${TITLE}</title>
<meta name="claude:viewport-fit-sides" content="cover">
${style}
${body}
${script}
`;

await mkdir(new URL('../site/qed/', import.meta.url), { recursive: true });
await mkdir(new URL('../build/', import.meta.url), { recursive: true });
await writeFile(new URL('../site/qed/index.html', import.meta.url), document);
await writeFile(new URL('../build/qed.artifact.html', import.meta.url), artifact);
console.log(`program: ${lines} lines, ${code.length} characters; page: ${Buffer.byteLength(document)} bytes`);
