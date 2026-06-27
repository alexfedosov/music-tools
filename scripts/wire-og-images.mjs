#!/usr/bin/env node
/*
 * Idempotently add og:image / twitter large-image cards to each tool page.
 *
 * The tool pages are authored by other parts of the suite; this script only
 * *adds* the social-image meta (and upgrades twitter:card to
 * summary_large_image) if it isn't already present, so it is safe to re-run
 * and safe to run alongside other edits. Run from the repo root:
 *   node scripts/wire-og-images.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const BASE = 'https://pockettempo.xyz';
const PAGES = [
  ['metronome/index.html', 'assets/og/metronome.png'],
  ['tap-tempo/index.html', 'assets/og/tap-tempo.png'],
  ['beat-maker/index.html', 'assets/og/beat-maker.png'],
  ['chords/index.html', 'assets/og/chords.png'],
];

let changed = 0;
for (const [page, img] of PAGES) {
  if (!existsSync(page)) { console.log(`skip (missing): ${page}`); continue; }
  let html = readFileSync(page, 'utf8');
  const before = html;
  const imgUrl = `${BASE}/${img}`;

  // 1) Insert og:image block right after the og:url meta, if absent.
  if (!html.includes('property="og:image"')) {
    html = html.replace(
      /(<meta property="og:url"[^>]*>)/,
      `$1\n  <meta property="og:image" content="${imgUrl}">\n  <meta property="og:image:width" content="1200">\n  <meta property="og:image:height" content="630">`
    );
  }

  // 2) Upgrade the twitter card to a large image.
  html = html.replace(
    /<meta name="twitter:card" content="summary">/,
    '<meta name="twitter:card" content="summary_large_image">'
  );

  // 3) Add twitter:image once, after the last twitter meta we can find.
  if (!html.includes('name="twitter:image"')) {
    if (/<meta name="twitter:description"[^>]*>/.test(html)) {
      html = html.replace(
        /(<meta name="twitter:description"[^>]*>)/,
        `$1\n  <meta name="twitter:image" content="${imgUrl}">`
      );
    } else {
      // No twitter:description present — append after the card line.
      html = html.replace(
        /(<meta name="twitter:card"[^>]*>)/,
        `$1\n  <meta name="twitter:image" content="${imgUrl}">`
      );
    }
  }

  if (html !== before) {
    writeFileSync(page, html);
    changed++;
    console.log(`wired og:image -> ${page}`);
  } else {
    console.log(`already wired: ${page}`);
  }
}
console.log(`done (${changed} changed)`);
