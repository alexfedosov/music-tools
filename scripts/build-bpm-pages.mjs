#!/usr/bin/env node
/*
 * Generate the long-tail "X BPM metronome" landing pages (CRA-24, SEO batch 1).
 *
 * Each page captures a high-intent search ("120 bpm metronome") and is a real,
 * useful page: unique copy about that tempo + a one-tap deep-link that starts
 * the metronome at exactly that BPM (../metronome/?bpm=NNN — the same URL
 * contract Tap Tempo and the Delay calculator use).
 *
 * Batch 1 is deliberately ONE template ("X BPM metronome") and a SMALL set, so
 * we can measure indexation per-template before scaling. Re-run any time:
 *   node scripts/build-bpm-pages.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://pockettempo.xyz';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// One entry per page. `blurb`/`genres` give each page genuinely unique copy so
// these read as real reference pages, not thin doorway pages.
const TEMPOS = [
  { bpm: 60,  word: 'sixty',        feel: 'a slow, spacious pulse — exactly one beat every second',
    blurb: 'At 60 BPM the click lands once a second, the slowest tempo most players practise to. It is the home of ballads, ambient, downtempo and half-time hip-hop, and a favourite for slow, deliberate technique work where every note has room to breathe.',
    genres: ['Slow ballads & film scores', 'Ambient & downtempo', 'Half-time hip-hop', 'Largo / Adagio practice'] },
  { bpm: 80,  word: 'eighty',       feel: 'a relaxed, heavy-headed groove',
    blurb: 'Eighty BPM is the laid-back pocket of boom-bap hip-hop, slow funk and smooth R&B. It is fast enough to feel a groove but slow enough that the backbeat hits hard — the tempo where a beat sits back and nods.',
    genres: ['Boom-bap hip-hop', 'Slow funk & soul', 'Downtempo R&B', 'Trap (half-time feel)'] },
  { bpm: 90,  word: 'ninety',       feel: 'the classic head-nod tempo',
    blurb: 'Ninety BPM is the engine room of 90s hip-hop and reggae. It is the tempo of countless classic boom-bap records and the steady one-drop of roots reggae — a relaxed walk that still carries real momentum.',
    genres: ['Classic 90s hip-hop', 'Roots reggae (one-drop)', 'Mid-tempo soul', 'Lo-fi beats'] },
  { bpm: 100, word: 'a hundred',    feel: 'an easy, mid-tempo stride',
    blurb: 'One hundred BPM is a round, friendly mid-tempo — common in pop, mid-tempo rock and dancehall. The maths is clean (a beat is 600 ms), which makes it a great reference tempo for learning and for setting tempo-synced effects.',
    genres: ['Pop & mid-tempo rock', 'Dancehall', 'Indie & singer-songwriter', 'Moderato practice'] },
  { bpm: 120, word: 'a hundred and twenty', feel: 'the default tempo of modern music',
    blurb: 'One hundred and twenty BPM is the unofficial default of modern music — house, disco, EDM, much of pop and the factory setting on nearly every drum machine and DAW. A beat is exactly 500 ms, so it is the cleanest tempo to learn delay and reverb timing on.',
    genres: ['House & disco', 'EDM & dance-pop', 'Pop & synthwave', 'Allegro practice'] },
  { bpm: 140, word: 'a hundred and forty', feel: 'a driving, high-energy tempo',
    blurb: 'One hundred and forty BPM is the home of dubstep and trap (which feels half-time, with the snare on beat 3) and a touchstone tempo for hard dance. It is brisk and urgent — great for building speed and stamina in practice.',
    genres: ['Dubstep & trap', 'Hard dance & techno', 'Drum & bass (half-time feel)', 'Speed / stamina practice'] },
];

const otherTempos = (cur) => TEMPOS.filter(t => t.bpm !== cur)
  .map(t => `<a class="chip" href="../${t.bpm}-bpm/">${t.bpm} BPM</a>`).join('\n          ');

function page(t) {
  const url = `${BASE}/metronome/${t.bpm}-bpm/`;
  const quarterMs = (60000 / t.bpm);
  const msText = Number.isInteger(quarterMs) ? quarterMs : quarterMs.toFixed(1);
  const title = `${t.bpm} BPM Metronome — Free Online Click | Pocket Tempo`;
  const desc = `Free ${t.bpm} BPM metronome. Start a rock-solid ${t.bpm} beats-per-minute click in your browser in one tap — accurate Web Audio timing, named feels, no ads, no signup.`;
  const keywords = `${t.bpm} bpm metronome, ${t.bpm} bpm, ${t.bpm} beats per minute, online metronome ${t.bpm}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  <meta name="keywords" content="${esc(keywords)}">
  <link rel="canonical" href="${url}">
  <meta name="theme-color" content="#0e1014">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Pocket Tempo">
  <meta property="og:title" content="${esc(t.bpm + ' BPM Metronome — free online click')}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${BASE}/assets/og/metronome.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(t.bpm + ' BPM Metronome — free online click')}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${BASE}/assets/og/metronome.png">

  <link rel="preconnect" href="https://ep-square-leaf-a6l5syhk.apirest.us-west-2.aws.neon.tech" crossorigin>
  <link rel="stylesheet" href="../../assets/css/site.css">
  <style>
    a.brand { color: var(--text); text-decoration: none; }
    .bpm-cta {
      display: block; text-align: center; text-decoration: none;
      background: var(--accent-2); color: #0c1512; font-weight: 800;
      font-size: 1.15rem; padding: 1.1rem 1rem; border-radius: var(--radius);
      margin: 0.5rem 0 1rem; letter-spacing: 0.01em;
    }
    .bpm-cta:hover { filter: brightness(1.06); }
    .bpm-facts { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0 0 1.2rem; }
    .crosslinks { display: flex; flex-wrap: wrap; gap: 0.5rem; margin: 0.4rem 0; }
  </style>

  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"${t.bpm} BPM Metronome","url":"${url}","applicationCategory":"MultimediaApplication","operatingSystem":"Any (web browser)","description":${JSON.stringify(desc)},"offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Pocket Tempo","item":"${BASE}/"},{"@type":"ListItem","position":2,"name":"Online Metronome","item":"${BASE}/metronome/"},{"@type":"ListItem","position":3,"name":"${t.bpm} BPM","item":"${url}"}]}</script>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="../../">Pocket<span class="dot">·</span>Tempo</a>
    <span class="tag">free web tools for music makers</span>
  </header>

  <main>
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="../../">All tools</a> <span aria-hidden="true">›</span>
      <a href="../../metronome/">Metronome</a> <span aria-hidden="true">›</span> <span>${t.bpm} BPM</span>
    </nav>

    <section class="hero">
      <h1>${t.bpm} BPM Metronome</h1>
      <p class="lede">A free, accurate ${t.bpm} beats-per-minute metronome — ${t.feel}. Tap the button below and it starts clicking at exactly ${t.bpm} BPM, right in your browser.</p>
    </section>

    <a class="bpm-cta" href="../../metronome/?bpm=${t.bpm}">▶ Start the ${t.bpm} BPM metronome</a>

    <div class="bpm-facts">
      <span class="feel-tag">${t.bpm} BPM</span>
      <span class="feel-tag">1 beat = ${msText} ms</span>
      <span class="feel-tag">Web Audio timing</span>
    </div>

    <section class="prose">
      <h2>What ${t.bpm} BPM feels like</h2>
      <p>${esc(t.blurb)}</p>
      <h2>Common at ${t.bpm} BPM</h2>
      <ul class="feel-heard">
        ${t.genres.map(g => `<li>${esc(g)}</li>`).join('\n        ')}
      </ul>
      <h2>Practise in the pocket, not on a grid</h2>
      <p>The big button above opens our <a href="../../metronome/">online metronome</a> already set to ${t.bpm} BPM. Unlike a plain click, it can groove in <a href="../../feel/">named human feels</a> — swing, the Dilla pocket, behind the beat — so ${t.bpm} BPM can lope or push instead of marching. Not sure of your song's tempo? <a href="../../tap-tempo/">Tap it out</a> and we'll read the BPM for you.</p>
      <h2>Setting effects at ${t.bpm} BPM</h2>
      <p>At ${t.bpm} BPM one beat is <strong>${msText} ms</strong>. To set a tempo-synced delay or reverb, our <a href="../../delay/?bpm=${t.bpm}">delay &amp; reverb time calculator</a> gives every note value at ${t.bpm} BPM — normal, dotted and triplet — plus the LFO rate in Hz.</p>
    </section>

    <section class="share-bar" aria-label="Other tempos">
      <span class="share-bar__label">Other tempos</span>
      <div class="crosslinks">
          ${otherTempos(t.bpm)}
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <span>Made for producers, beatmakers &amp; bedroom musicians.</span>
    <span><a href="../../">More tools →</a></span>
  </footer>

  <script src="../../assets/js/config.js"></script>
  <script>window.ANALYTICS && (window.ANALYTICS.tool = 'metronome:${t.bpm}bpm');</script>
  <script defer src="../../assets/js/analytics.js"></script>
  <script defer src="../../assets/js/share.js"></script>
</body>
</html>
`;
}

let written = [];
for (const t of TEMPOS) {
  const dir = join(ROOT, 'metronome', `${t.bpm}-bpm`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), page(t));
  written.push(`/metronome/${t.bpm}-bpm/`);
}
console.log('Wrote ' + written.length + ' BPM pages:\n  ' + written.join('\n  '));
