#!/usr/bin/env node
/*
 * Generate the Feel Library landing pages from the single source of truth
 * (assets/js/feels.js): one SEO page per named feel, plus the /feel/ hub.
 *
 * These are the shareable artifacts of the growth loop: a producer shares
 * "practise the Dilla pocket" -> a new visitor lands on a rich, on-brand page
 * -> one tap plays that exact feel in the metronome. Re-run any time the Feel
 * Library changes:
 *   node scripts/build-feel-pages.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FEELS, NAMED_FEELS } from '../assets/js/feels.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://pockettempo.xyz';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function head({ title, desc, canonical, ogTitle, ogImage, keywords, rel }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}">
  ${keywords ? `<meta name="keywords" content="${esc(keywords)}">` : ''}
  <link rel="canonical" href="${canonical}">
  <meta name="theme-color" content="#0e1014">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Pocket Tempo">
  <meta property="og:title" content="${esc(ogTitle)}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(ogTitle)}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${ogImage}">

  <link rel="preconnect" href="https://ep-square-leaf-a6l5syhk.apirest.us-west-2.aws.neon.tech" crossorigin>
  <link rel="stylesheet" href="${rel}assets/css/site.css">`;
}

function chrome(rel, crumbLeaf) {
  return `</head>
<body>
  <header class="site-header">
    <a class="brand" href="${rel}">Pocket<span class="dot">·</span>Tempo</a>
    <span class="tag">free web tools for music makers</span>
  </header>

  <main>
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="${rel}">All tools</a> <span aria-hidden="true">›</span>
      <a href="${rel}feel/">Feel Library</a> <span aria-hidden="true">›</span> <span>${esc(crumbLeaf)}</span>
    </nav>`;
}

function footer(rel, tool, sessionFeel) {
  return `
  </main>

  <footer class="site-footer">
    <span>Made for producers, beatmakers &amp; bedroom musicians.</span>
    <span><a href="${rel}">More tools →</a></span>
  </footer>

  <script src="${rel}assets/js/config.js"></script>
  <script>window.ANALYTICS.tool = ${JSON.stringify(tool)};</script>
  <script defer src="${rel}assets/js/analytics.js"></script>
  <script defer src="${rel}assets/js/share.js"></script>
  <script>window.addEventListener('load', function () {
    if (window.trackOncePerSession) window.trackOncePerSession('feel_session', ${JSON.stringify(sessionFeel)});
  });</script>
</body>
</html>
`;
}

// ---- per-feel landing page ----
function feelPage(feel) {
  const rel = '../../';
  const canonical = `${BASE}/feel/${feel.id}/`;
  const ogImage = `${BASE}/assets/og/feel-${feel.id}.png`;
  const playUrl = `${rel}metronome/?feel=${feel.id}&bpm=${feel.defaultBpm}`;
  const title = `${feel.name} Feel — Practise the ${feel.name} Pocket | Pocket Tempo`;
  const desc = `${feel.tagline} ${feel.about}`.slice(0, 300);

  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: `${feel.name} Metronome Feel`,
    url: canonical,
    applicationCategory: 'MultimediaApplication',
    operatingSystem: 'Any (web browser)',
    description: `${feel.tagline} ${feel.about}`,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  const crumbs = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Pocket Tempo', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Feel Library', item: `${BASE}/feel/` },
      { '@type': 'ListItem', position: 3, name: feel.name, item: canonical },
    ],
  };

  const others = NAMED_FEELS.filter((f) => f.id !== feel.id);

  return head({
    title, desc, canonical,
    ogTitle: `${feel.name} — ${feel.tagline}`,
    ogImage, keywords: feel.keywords, rel,
  }) + `
  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>
  <script type="application/ld+json">${JSON.stringify(crumbs)}</script>
` + chrome(rel, feel.name) + `
    <section class="feel-hero" style="--feel-color:${feel.color}">
      <div class="feel-hero__emoji" aria-hidden="true">${feel.emoji}</div>
      <div>
        <h1>The ${esc(feel.name)} feel</h1>
        <p class="feel-hero__tag">${esc(feel.tagline)}</p>
      </div>
    </section>

    <a class="feel-cta" href="${playUrl}" data-feel-cta="${feel.id}">▶ Play the ${esc(feel.name)} feel in the metronome</a>

    <div class="feel-meta">
      <span class="feel-tag">${esc(feel.sub)}</span>
      <span class="feel-tag">≈ ${feel.defaultBpm} BPM</span>
      ${feel.pulse ? '<span class="feel-tag">with reference pulse</span>' : ''}
    </div>

    <section class="prose">
      <h2>What it is</h2>
      <p>${esc(feel.about)}</p>
      <h2>How to practise it</h2>
      <p>${esc(feel.howto)}</p>
      <h2>Heard on</h2>
      <ul class="feel-heard">
        ${feel.heardOn.map((h) => `<li>${esc(h)}</li>`).join('\n        ')}
      </ul>
    </section>

    <section class="share-bar" aria-label="Share this feel">
      <span class="share-bar__label">Know someone working on their pocket?</span>
      <div class="share-bar__actions">
        <button class="chip" type="button" data-copy-link="${canonical}">Copy link</button>
        <a class="chip" href="https://twitter.com/intent/tweet?text=${encodeURIComponent('Practise the ' + feel.name + ' feel — free, in your browser 🥁')}&url=${encodeURIComponent(canonical)}" target="_blank" rel="noopener">Share on X</a>
        <a class="chip chip--tip" data-tip-jar href="#" target="_blank" rel="noopener" hidden>☕ Buy me a coffee</a>
      </div>
    </section>

    <section class="prose">
      <h2>More feels in the library</h2>
      <div class="feel-grid">
        ${others.map((f) => `<a class="feel-card" href="${rel}feel/${f.id}/" style="--feel-color:${f.color}">
          <span class="feel-card__emoji" aria-hidden="true">${f.emoji}</span>
          <span><span class="feel-card__name">${esc(f.name)}</span><span class="feel-card__tag">${esc(f.tagline)}</span></span>
        </a>`).join('\n        ')}
      </div>
    </section>
` + footer(rel, `feel:${feel.id}`, feel.id) + `
  <script>document.querySelectorAll('[data-feel-cta]').forEach(function (a) {
    a.addEventListener('click', function () { if (window.track) window.track('feel_play_cta', a.getAttribute('data-feel-cta')); });
  });</script>`;
}

// ---- Feel Library hub ----
function hubPage() {
  const rel = '../';
  const canonical = `${BASE}/feel/`;
  const ogImage = `${BASE}/assets/og/feel-library.png`;
  const title = 'The Feel Library — Named Human Grooves for Your Metronome | Pocket Tempo';
  const desc = 'Stop practising to a robot. The Feel Library is a curated set of named, real-record grooves — J Dilla, the Purdie shuffle, boom-bap, swing, behind the beat — you can play in a free online metronome.';

  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'The Feel Library',
    itemListElement: NAMED_FEELS.map((f, i) => ({
      '@type': 'ListItem', position: i + 1, name: `${f.name} feel`, url: `${BASE}/feel/${f.id}/`,
    })),
  };

  return head({ title, desc, canonical, ogTitle: 'The Feel Library — stop practising to a robot', ogImage, keywords: 'metronome feels, groove library, dilla feel, purdie shuffle, swing, boom bap, behind the beat', rel })
    + `
  <script type="application/ld+json">${JSON.stringify(itemList)}</script>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="${rel}">Pocket<span class="dot">·</span>Tempo</a>
    <span class="tag">free web tools for music makers</span>
  </header>

  <main>
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="${rel}">All tools</a> <span aria-hidden="true">›</span> <span>Feel Library</span>
    </nav>

    <section class="hero">
      <h1>The Feel Library</h1>
      <p class="lede">Every other metronome gives you a grid and, if you're lucky, a "swing %" slider. We give you <strong>named human feels</strong> — the grooves off the records you love, playable in one tap. Stop practising to a robot. Play in the pocket.</p>
    </section>

    <div class="feel-grid">
      ${NAMED_FEELS.map((f) => `<a class="feel-card" href="${rel}feel/${f.id}/" style="--feel-color:${f.color}">
        <span class="feel-card__emoji" aria-hidden="true">${f.emoji}</span>
        <span><span class="feel-card__name">${esc(f.name)}</span><span class="feel-card__tag">${esc(f.tagline)}</span></span>
      </a>`).join('\n      ')}
    </div>

    <section class="prose">
      <h2>What makes a "feel"?</h2>
      <p>A feel is where the notes actually land. A drum machine puts every hit dead on the grid; a great drummer leans — dragging behind for a fat pocket, pushing on top for urgency, swinging the off-beats onto the triplet. Each feel here is a real micro-timing pattern, scheduled on a sample-accurate Web Audio clock, so the click grooves like the record instead of a robot. Flip on the <strong>steady reference pulse</strong> and you can hear the feel lean against true time.</p>
      <p>Pick any feel and it opens in our free <a href="${rel}metronome/">online metronome</a>, pre-set and ready to play — no signup, no ads in the way.</p>
    </section>
` + footer(rel, 'feel:library', 'library');
}

// ---- write ----
mkdirSync(join(ROOT, 'feel'), { recursive: true });
writeFileSync(join(ROOT, 'feel', 'index.html'), hubPage());
console.log('wrote feel/index.html');
for (const feel of NAMED_FEELS) {
  const dir = join(ROOT, 'feel', feel.id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), feelPage(feel));
  console.log(`wrote feel/${feel.id}/index.html`);
}
console.log(`done (${NAMED_FEELS.length} feel pages + hub)`);
