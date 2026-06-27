#!/usr/bin/env node
/*
 * Render the Feel Library social cards (1200×630 PNG) with headless Chrome,
 * one per named feel plus a library cover. Source of truth = feels.js.
 *   node scripts/build-feel-og.mjs
 * Requires Google Chrome / Chromium. Output -> assets/og/feel-<id>.png
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { NAMED_FEELS } from '../assets/js/feels.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEMPLATE = join(ROOT, 'scripts', 'og-feel-template.html');
const OUT = join(ROOT, 'assets', 'og');
mkdirSync(OUT, { recursive: true });

const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser',
];
const chrome = CHROME_CANDIDATES.find((c) => c.startsWith('/') ? existsSync(c) : true);

function render(params, outFile) {
  const qs = new URLSearchParams(params).toString();
  const url = `file://${TEMPLATE}?${qs}`;
  execFileSync(chrome, [
    '--headless', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1200,630',
    `--screenshot=${outFile}`,
    url,
  ], { stdio: 'ignore' });
  console.log(`wrote ${outFile.replace(ROOT + '/', '')}`);
}

// Cover card for the /feel/ hub.
render({
  name: 'The Feel Library', emoji: '🎛️', color: '#ff5d5d',
  kicker: 'STOP PRACTISING TO A ROBOT',
  tag: 'Named human grooves — Dilla, swing, Purdie shuffle, boom-bap — in a free metronome.',
  bpm: '',
}, join(OUT, 'feel-library.png'));

for (const f of NAMED_FEELS) {
  render({
    name: f.name, emoji: f.emoji, color: f.color,
    kicker: 'PLAY THE FEEL',
    tag: f.tagline,
    bpm: `≈ ${f.defaultBpm} BPM`,
  }, join(OUT, `feel-${f.id}.png`));
}
console.log('done');
