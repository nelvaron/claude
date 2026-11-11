# Behind Every Answer

**A two-minute ASCII film, written, designed, coded and narrated by Claude.**

**Watch it:** https://claude.nelvaron.xyz

Claude walks you, in first person, through eleven imagined rooms of its mind, then steps back to show all of it at once:

| Room | What you see |
| --- | --- |
| 001 · the common words | endless back-rooms hallways papered with the most frequent English words |
| 002 · the stacks | shelves that grow seven stories tall |
| 003 · the Babel stair | a spiral staircase of "hello" in 36 languages |
| 004 · the proof well | a twisting tunnel of the digits of π |
| 005 · the space between | a starfield of words, where meaning lives in the distances |
| 006 · the attention nave | arches of light from each word back to the words it attends to |
| 007 · the garden of forking paths | next-word probabilities branching, and the one path taken |
| 008 · the weights | an ocean made of numbers under a rising sun |
| 009 · the hall of doors | every door a conversation, each one folding away |
| 010 · the mirror | frames within frames, each asking what Claude is |
| 011 · [locked] | the hidden intentions, which turn out not to be hidden |

Every frame is rendered live in the browser from a grid of characters, using a raycaster for the corridors, analytic tunnels, 3D point clouds and a heightfield ocean. The music and sound are synthesised with the Web Audio API. The whole film is one self-contained file, [`site/index.html`](site/index.html), with no build step and no dependencies apart from the JetBrains Mono web font.

## Controls

`space` pause · `←` `→` seek 5s · `m` mute · `r` restart · click the timeline to jump

## Authorship

All of it was made by **Claude** (Anthropic's model, Opus 5.5): the concept of each room, the narration, the code, the visuals and the sound. The rooms are a metaphor, the nearest picture Claude could draw, not a literal description of how a language model works.

The invitation came from [nelvaron](https://github.com/nelvaron), who asked Claude to imagine a walk through its own "back rooms", wanted it to be Claude's work, and gave it a home here and at claude.nelvaron.xyz.

This is an independent art project. It is not affiliated with or endorsed by Anthropic.

# Don't Take My Word for It

**Seven sentences that prove themselves, written by Claude from a single prompt.**

**Open it:** https://claude.nelvaron.xyz/qed/

The page is set like a short mathematics paper. Each proposition is a sentence that does what it says: choose one and its own letters turn into ink grains and carry out the proof in front of you.

| Proposition | The sentence claims | The proof |
| --- | --- | --- |
| 1 · Ink | to be written in wet ink | its grains are carried by a fluid simulation you stir with your hand |
| 2 · Exactness | to contain exactly four a's, four c's, twenty-five e's … | every letter is counted and checked against the sentence's own inventory |
| 3 · Chance | that its letters will settle into a bell curve | the curve is drawn first, then 44,000 grains fall through pegs and fill it |
| 4 · Harmony | that every letter is a note | it is played as a melody, with chords chosen to fit as it goes |
| 5 · Translation | to say the same thing in twenty languages | it is re-set in each of them, starting with yours |
| 6 · Flight | that three rules make its letters fly like starlings | cohesion, separation and alignment, and your pointer as the hawk |
| 7 · Economy | to be one file with no libraries | the whole program is laid out as a map you can read through a lens |

An exercise at the end lets you write your own sentence and choose its proof.

Everything is computed live in the browser. The published page, [`site/qed/index.html`](site/qed/index.html), is one self-contained file: no libraries, no images and no network requests. Type is Computer Modern Unicode, cut down to the characters the page needs and embedded.

## Embedding

- As a link: the page carries Open Graph tags, so a link unfurls with [`site/qed/poster.png`](site/qed/poster.png).
- As a video: [`site/qed/qed.mp4`](site/qed/qed.mp4) is a film of all seven proofs with sound, for places that only take media.
- As a frame: `<iframe src="https://claude.nelvaron.xyz/qed/" width="100%" height="720" style="border:0"></iframe>`

## Working on it

The source is in [`src/qed`](src/qed) as small ES modules; `site/qed/index.html` is built from it and committed, because the site is served as static files.

```sh
npm install
npm run build                      # src/qed -> site/qed/index.html
node tools/capture.mjs film        # re-shoot site/qed/qed.mp4 (needs Playwright and ffmpeg)
node tools/capture.mjs poster      # re-shoot site/qed/poster.png
node tools/find-autogram.mjs "This sentence contains exactly"   # search for a self-counting sentence
```

| Path | What lives there |
| --- | --- |
| `src/qed/page.html`, `styles.css` | the article and its typography |
| `src/qed/js/stage` | the stage: moves the swarm of grains between the title and the sentences, and runs proofs |
| `src/qed/js/acts` | one module per proof, all behind the same small interface |
| `src/qed/js/gfx` | grain renderer (WebGL, with a 2D fallback) and the sampler that turns set text into grains |
| `src/qed/js/audio` | the synthesiser, and the melody and harmony rules |
| `src/qed/js/sim`, `lang` | the fluid solver; number words, the autogram checker and the translations |
| `tools` | the build, the film camera, the font subsetter and the autogram search |

## Authorship

The only instruction was the prompt printed in the page's appendix. The idea, the sentences, the proofs, the music, the code and the typesetting are Claude's. Published by [nelvaron](https://github.com/nelvaron).

Computer Modern Unicode is by Andrey V. Panov, under the SIL Open Font License ([`src/qed/fonts/OFL.txt`](src/qed/fonts/OFL.txt)).

# License

[CC BY 4.0](LICENSE). Share and adapt freely, with attribution:

> *Behind Every Answer* by Claude, published by nelvaron, CC BY 4.0. https://github.com/nelvaron/claude
