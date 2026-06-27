#!/usr/bin/env node
/*
 * Generate the long-tail BPM landing pages for the suite.
 *
 * Two page types share ONE curated tempo set (see TEMPOS below):
 *   1. /metronome/{bpm}-bpm/ — "X BPM metronome": unique copy about the tempo +
 *      a one-tap deep-link that starts the metronome at exactly that BPM.
 *   2. /delay/{bpm}-bpm/      — "X BPM delay times": a pre-rendered delay-time
 *      chart (normal / dotted / triplet, in ms) for that BPM, captioned with the
 *      famous dotted-eighth value, PLUS the live interactive calculator. Targets
 *      "dotted eighth delay 140 bpm"-style intent we own the math for.
 *
 * CURATED, NOT CARPET-BOMBED (CRA-29 guardrail). This is a hand-picked set of
 * high-demand tempos (genre-native: 128 house, 174 DnB, etc.), NOT the full
 * 40–240 tail. The full tail is gated on CRA-25 analytics confirming these
 * pages index + earn clicks. Re-run any time (idempotent, also rewrites the
 * sitemap's bpm section):
 *   node scripts/build-bpm-pages.mjs
 */
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://pockettempo.xyz';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// One entry per tempo. `blurb`/`genres` give each page genuinely unique copy so
// these read as real reference pages, not thin doorway pages. Both the metronome
// and the delay page for a given BPM draw on the same entry.
const TEMPOS = [
  { bpm: 60,  word: 'sixty',        feel: 'a slow, spacious pulse — exactly one beat every second',
    blurb: 'At 60 BPM the click lands once a second, the slowest tempo most players practise to. It is the home of ballads, ambient, downtempo and half-time hip-hop, and a favourite for slow, deliberate technique work where every note has room to breathe.',
    genres: ['Slow ballads & film scores', 'Ambient & downtempo', 'Half-time hip-hop', 'Largo / Adagio practice'] },
  { bpm: 70,  word: 'seventy',      feel: 'a slow, weighty pulse',
    blurb: 'Seventy BPM is heavy and unhurried — the pocket of slow soul, sensual R&B and half-time trap, where the hi-hats skitter while the snare lands on beat 3. Just above a resting heartbeat, it feels deliberate without dragging.',
    genres: ['Slow-jam R&B & soul', 'Half-time trap', 'Downtempo & lo-fi', 'Slow blues'] },
  { bpm: 80,  word: 'eighty',       feel: 'a relaxed, heavy-headed groove',
    blurb: 'Eighty BPM is the laid-back pocket of boom-bap hip-hop, slow funk and smooth R&B. It is fast enough to feel a groove but slow enough that the backbeat hits hard — the tempo where a beat sits back and nods.',
    genres: ['Boom-bap hip-hop', 'Slow funk & soul', 'Downtempo R&B', 'Trap (half-time feel)'] },
  { bpm: 85,  word: 'eighty-five',  feel: 'an easy, swung head-nod',
    blurb: 'Eighty-five BPM sits in the sweet spot of classic hip-hop and neo-soul — relaxed enough to lean all the way back, quick enough to bump in the car. A huge share of golden-era boom-bap records live right around here.',
    genres: ['Golden-era hip-hop', 'Neo-soul', 'Reggae & dub', 'Lo-fi beats'] },
  { bpm: 90,  word: 'ninety',       feel: 'the classic head-nod tempo',
    blurb: 'Ninety BPM is the engine room of 90s hip-hop and reggae. It is the tempo of countless classic boom-bap records and the steady one-drop of roots reggae — a relaxed walk that still carries real momentum.',
    genres: ['Classic 90s hip-hop', 'Roots reggae (one-drop)', 'Mid-tempo soul', 'Lo-fi beats'] },
  { bpm: 95,  word: 'ninety-five',  feel: 'a brisk, walking groove',
    blurb: 'Ninety-five BPM is an up-tempo head-nod — the bounce of West-Coast hip-hop, funky-drummer breaks and bright reggae. It walks with real purpose without ever tipping into a rush.',
    genres: ['West-Coast hip-hop', 'Funk breaks', 'Reggae & dancehall', 'Mid-tempo pop'] },
  { bpm: 100, word: 'a hundred',    feel: 'an easy, mid-tempo stride',
    blurb: 'One hundred BPM is a round, friendly mid-tempo — common in pop, mid-tempo rock and dancehall. The maths is clean (a beat is 600 ms), which makes it a great reference tempo for learning and for setting tempo-synced effects.',
    genres: ['Pop & mid-tempo rock', 'Dancehall', 'Indie & singer-songwriter', 'Moderato practice'] },
  { bpm: 110, word: 'a hundred and ten', feel: 'a loose, body-moving tempo',
    blurb: 'One hundred and ten BPM is the loose, body-moving tempo of modern hip-hop, dancehall and downtempo house. Quick enough to dance to, relaxed enough to rap over — a favourite of trap-pop crossovers and reggaeton.',
    genres: ['Modern hip-hop & trap-pop', 'Reggaeton & dancehall', 'Downtempo house', 'Pop'] },
  { bpm: 120, word: 'a hundred and twenty', feel: 'the default tempo of modern music',
    blurb: 'One hundred and twenty BPM is the unofficial default of modern music — house, disco, EDM, much of pop and the factory setting on nearly every drum machine and DAW. A beat is exactly 500 ms, so it is the cleanest tempo to learn delay and reverb timing on.',
    genres: ['House & disco', 'EDM & dance-pop', 'Pop & synthwave', 'Allegro practice'] },
  { bpm: 128, word: 'a hundred and twenty-eight', feel: 'the four-on-the-floor club standard',
    blurb: 'One hundred and twenty-eight BPM is THE club tempo — the four-on-the-floor heartbeat of house, mainstream EDM, big-room and most peak-time techno. If a festival track feels "just right" on the main stage, it is probably here. A beat is 468.75 ms.',
    genres: ['House & big-room EDM', 'Peak-time techno', 'Progressive & electro', 'Dance-pop'] },
  { bpm: 130, word: 'a hundred and thirty', feel: 'driving club energy',
    blurb: 'One hundred and thirty BPM pushes a notch past the house standard — the engine of tech-house, faster techno and the lower end of trance. It is where the dancefloor stops swaying and starts driving.',
    genres: ['Tech-house', 'Techno', 'Trance (lower end)', 'Hard house'] },
  { bpm: 140, word: 'a hundred and forty', feel: 'a driving, high-energy tempo',
    blurb: 'One hundred and forty BPM is the home of dubstep and trap (which feels half-time, with the snare on beat 3) and a touchstone tempo for hard dance. It is brisk and urgent — great for building speed and stamina in practice.',
    genres: ['Dubstep & trap', 'Hard dance & techno', 'Drum & bass (half-time feel)', 'Speed / stamina practice'] },
  { bpm: 150, word: 'a hundred and fifty', feel: 'a fast, high-energy drive',
    blurb: 'One hundred and fifty BPM is fast and relentless — the grid of harder dance styles, double-time trap hats and psytrance’s lower end. Halve it and it feels like a heavy 75; it is a great tempo for pushing your practice speed.',
    genres: ['Harder dance & hardcore', 'Double-time trap', 'Psytrance (lower end)', 'Fast punk'] },
  { bpm: 160, word: 'a hundred and sixty', feel: 'a rapid, propulsive pulse',
    blurb: 'One hundred and sixty BPM is genuinely quick — the grid of footwork and juke, the double-time feel of trap, and (heard as half-time) a common drum-and-bass reference. Fast bluegrass and punk live up here too.',
    genres: ['Footwork & juke', 'Double-time trap', 'Drum & bass (half-time feel)', 'Bluegrass & fast punk'] },
  { bpm: 170, word: 'a hundred and seventy', feel: 'classic drum & bass territory',
    blurb: 'One hundred and seventy BPM is a classic drum-and-bass tempo — fast breakbeats that, over a half-time bassline, feel deceptively relaxed. It is also where jungle, footwork and frantic punk live.',
    genres: ['Drum & bass', 'Jungle', 'Footwork', 'Fast punk & thrash'] },
  { bpm: 174, word: 'a hundred and seventy-four', feel: 'the drum & bass standard',
    blurb: 'One hundred and seventy-four BPM is the de-facto standard tempo of modern drum & bass — almost every DnB and neurofunk track is mixed right here. The breakbeats fly while a half-time bassline anchors the whole groove.',
    genres: ['Drum & bass', 'Neurofunk', 'Liquid DnB', 'Jungle'] },
  { bpm: 180, word: 'a hundred and eighty', feel: 'a very fast, top-end pulse',
    blurb: 'One hundred and eighty BPM sits at the top end of common tempos — fast drum & bass, thrash and hardcore punk, and double-time technical practice. Heard as half-time it is a relaxed 90, which is how many of these fast tracks actually feel.',
    genres: ['Fast drum & bass', 'Thrash & hardcore punk', 'Speedcore (lower end)', 'Sprint-tempo practice'] },
];

// Note values for the delay chart: ms = (60000 / bpm) * (4 / d) * mult.
const NOTES = [
  { name: 'Whole',         sub: '1/1',         d: 1 },
  { name: 'Half',          sub: '1/2',         d: 2 },
  { name: 'Quarter',       sub: '1/4 · beat',  d: 4, beat: true },
  { name: 'Eighth',        sub: '1/8',         d: 8 },
  { name: 'Sixteenth',     sub: '1/16',        d: 16 },
  { name: 'Thirty-second', sub: '1/32',        d: 32 },
];
const MULT = [1, 1.5, 2 / 3];          // normal, dotted, triplet
const msFor = (bpm, d, mult) => (60000 / bpm) * (4 / d) * mult;
// Match assets/js/delay-calc.js exactly: 2-dp precision under 1000 ms (trailing
// zeros trimmed), whole numbers above. So a quarter at 128 BPM reads 468.75.
const fmtMs = (ms) => (ms >= 1000 ? String(Math.round(ms)) : String(Math.round(ms * 100) / 100));

// ---- metronome page ------------------------------------------------------
function metronomePage(t) {
  const url = `${BASE}/metronome/${t.bpm}-bpm/`;
  const quarterMs = (60000 / t.bpm);
  const msText = Number.isInteger(quarterMs) ? String(quarterMs) : quarterMs.toFixed(1);
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
      <p>At ${t.bpm} BPM one beat is <strong>${msText} ms</strong>. To set a tempo-synced delay or reverb, our <a href="../../delay/${t.bpm}-bpm/">${t.bpm} BPM delay-time chart</a> lists every note value — normal, dotted and triplet — plus the LFO rate in Hz.</p>
    </section>

    <section class="share-bar" aria-label="Other tempos">
      <span class="share-bar__label">Other tempos</span>
      <div class="crosslinks">
          ${otherMetronome(t.bpm)}
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

// ---- delay page ----------------------------------------------------------
function delayRowsHtml(bpm) {
  return NOTES.map((n) => {
    const cells = MULT.map((mult) => {
      const m = fmtMs(msFor(bpm, n.d, mult));
      return `<td><button class="val" type="button" data-copy="${m}">${m}<span class="u"> ms</span></button></td>`;
    }).join('');
    return `<tr class="${n.beat ? 'beat-row' : ''}"><th scope="row">${n.name}<small>${n.sub}</small></th>${cells}</tr>`;
  }).join('\n          ');
}

function delayPage(t) {
  const url = `${BASE}/delay/${t.bpm}-bpm/`;
  const quarter = fmtMs(msFor(t.bpm, 4, 1));
  const eighth = fmtMs(msFor(t.bpm, 8, 1));
  const dottedEighth = fmtMs(msFor(t.bpm, 8, 1.5));
  const sixteenth = fmtMs(msFor(t.bpm, 16, 1));
  const title = `${t.bpm} BPM Delay Time Chart — Dotted, Triplet & Reverb (ms) | Pocket Tempo`;
  const desc = `Delay times at ${t.bpm} BPM: quarter ${quarter} ms, eighth ${eighth} ms, dotted-eighth ${dottedEighth} ms, plus triplets, sixteenths and LFO Hz. Free ${t.bpm} BPM delay & reverb time chart with a live calculator.`;
  const keywords = `${t.bpm} bpm delay time, delay time ${t.bpm} bpm, dotted eighth delay ${t.bpm} bpm, ${t.bpm} bpm delay ms, ${t.bpm} bpm reverb time`;
  const faq = {
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: `What delay time should I use at ${t.bpm} BPM?`,
        acceptedAnswer: { '@type': 'Answer', text: `At ${t.bpm} BPM a quarter-note delay is ${quarter} ms, an eighth-note delay is ${eighth} ms, a sixteenth is ${sixteenth} ms, and the popular dotted-eighth delay is ${dottedEighth} ms.` } },
      { '@type': 'Question', name: `What is the dotted eighth delay at ${t.bpm} BPM?`,
        acceptedAnswer: { '@type': 'Answer', text: `The dotted-eighth delay at ${t.bpm} BPM is ${dottedEighth} ms (1.5 × the ${eighth} ms eighth note). It is the shimmering off-grid repeat heard on countless guitar and pop productions.` } },
    ],
  };
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
  <meta property="og:title" content="${esc(t.bpm + ' BPM Delay Time Chart — dotted, triplet & reverb (ms)')}">
  <meta property="og:description" content="${esc(desc)}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${BASE}/assets/og/hub.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(t.bpm + ' BPM Delay Time Chart (ms)')}">
  <meta name="twitter:description" content="${esc(desc)}">
  <meta name="twitter:image" content="${BASE}/assets/og/hub.png">

  <link rel="preconnect" href="https://ep-square-leaf-a6l5syhk.apirest.us-west-2.aws.neon.tech" crossorigin>
  <link rel="stylesheet" href="../../assets/css/site.css">
  <link rel="stylesheet" href="../../assets/css/delay.css">

  <script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"${t.bpm} BPM Delay Time Calculator","url":"${url}","applicationCategory":"MultimediaApplication","operatingSystem":"Any (web browser)","description":${JSON.stringify(desc)},"offers":{"@type":"Offer","price":"0","priceCurrency":"USD"}}</script>
  <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","position":1,"name":"Pocket Tempo","item":"${BASE}/"},{"@type":"ListItem","position":2,"name":"Delay & Reverb Calculator","item":"${BASE}/delay/"},{"@type":"ListItem","position":3,"name":"${t.bpm} BPM","item":"${url}"}]}</script>
  <script type="application/ld+json">${JSON.stringify(faq)}</script>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="../../">Pocket<span class="dot">·</span>Tempo</a>
    <span class="tag">free web tools for music makers</span>
  </header>

  <main>
    <nav class="crumbs" aria-label="Breadcrumb">
      <a href="../../">All tools</a> <span aria-hidden="true">›</span>
      <a href="../../delay/">Delay &amp; Reverb Calculator</a> <span aria-hidden="true">›</span> <span>${t.bpm} BPM</span>
    </nav>

    <section class="hero">
      <h1>${t.bpm} BPM Delay Times</h1>
      <p class="lede">Every tempo-synced delay and reverb time at <strong>${t.bpm} BPM</strong>, in milliseconds — normal, dotted and triplet. The chart is pre-filled for ${t.bpm} BPM; change the tempo to recalculate, and tap any value to copy it.</p>
    </section>

    <div class="delay-headline">
      <span><span class="lbl">Dotted-eighth delay</span> <b>${dottedEighth} ms</b></span>
      <span><span class="lbl">Quarter</span> <b>${quarter} ms</b></span>
      <span><span class="lbl">Eighth</span> <b>${eighth} ms</b></span>
    </div>

    <section class="metronome" aria-label="Delay time calculator">
      <div class="bpm-input-row">
        <label for="bpm">Tempo</label>
        <input type="number" id="bpm" min="20" max="400" step="1" value="${t.bpm}"
               inputmode="numeric" aria-label="Tempo in beats per minute">
        <span class="unit">BPM</span>
        <span class="unit-toggle" role="group" aria-label="Output unit">
          <button type="button" id="unit-ms" aria-pressed="true">ms</button>
          <button type="button" id="unit-hz" aria-pressed="false">Hz</button>
        </span>
      </div>

      <table class="delay-table">
        <caption id="table-caption">Delay times at ${t.bpm} BPM, in milliseconds</caption>
        <thead>
          <tr>
            <th scope="col" style="text-align:left">Note</th>
            <th scope="col">Normal</th>
            <th scope="col">Dotted&nbsp;·1.5</th>
            <th scope="col">Triplet&nbsp;·⅔</th>
          </tr>
        </thead>
        <tbody id="rows">
          ${delayRowsHtml(t.bpm)}
        </tbody>
      </table>
      <p class="copy-hint">Tap any value to copy it to your clipboard. Switch to <strong>Hz</strong> to sync an LFO.</p>

      <div class="share" id="share" style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap;margin-bottom:1.2rem;padding:0.85rem 1rem;background:var(--bg-elev-2);border:1px solid var(--border);border-radius:12px;">
        <span class="share-bar__label">Need the tempo first?</span>
        <div class="crosslinks">
          <a class="chip" href="../../tap-tempo/">⇥ Tap it out</a>
          <a class="chip" href="../../metronome/${t.bpm}-bpm/" id="metro-link" data-base="../../metronome/">♪ ${t.bpm} BPM metronome</a>
        </div>
      </div>
    </section>

    <section class="prose">
      <h2>Delay &amp; reverb times at ${t.bpm} BPM</h2>
      <p>At ${t.bpm} BPM one beat (a quarter note) is <strong>${quarter} ms</strong>, so an eighth-note delay is <strong>${eighth} ms</strong> and a sixteenth is <strong>${sixteenth} ms</strong>. Dial any of these into your delay or set a tempo-synced reverb's pre-delay to the sixteenth and its tail to fade around a beat or two. The full chart above covers every note value.</p>
      <h2>The dotted-eighth delay at ${t.bpm} BPM</h2>
      <p>The famous <em>dotted-eighth delay</em> — the shimmering, off-grid repeat behind countless guitar and pop productions — is <strong>${dottedEighth} ms</strong> at ${t.bpm} BPM (1.5× the ${eighth} ms eighth note). A <strong>triplet</strong> delay is ⅔ of the plain note instead, giving a rolling, galloping echo; both columns are in the chart.</p>
      <h2>${t.bpm} BPM in context</h2>
      <p>${esc(t.blurb)} Practise against it in the <a href="../../metronome/${t.bpm}-bpm/">${t.bpm} BPM metronome</a> — the only one with named human <a href="../../feel/">feels</a>.</p>
      <h2>Find your BPM</h2>
      <p>Not sure of your track's tempo? <a href="../../tap-tempo/">Tap it out</a> and it sends the BPM straight to the <a href="../../delay/">full delay calculator</a>. Switch the chart above to <strong>Hz</strong> (it's just 1000 ÷ ms) to sync an LFO, tremolo or auto-filter.</p>
    </section>

    <section class="share-bar" aria-label="Other tempos">
      <span class="share-bar__label">Other tempos</span>
      <div class="crosslinks">
          ${otherDelay(t.bpm)}
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <span>Made for producers, beatmakers &amp; bedroom musicians.</span>
    <span><a href="../../">More tools →</a></span>
  </footer>

  <script src="../../assets/js/config.js"></script>
  <script>window.ANALYTICS && (window.ANALYTICS.tool = 'delay:${t.bpm}bpm');</script>
  <script defer src="../../assets/js/analytics.js"></script>
  <script defer src="../../assets/js/share.js"></script>
  <script defer src="../../assets/js/delay-calc.js"></script>
</body>
</html>
`;
}

// Cross-link chips to the other tempos in the set (same page type).
const otherMetronome = (cur) => TEMPOS.filter(t => t.bpm !== cur)
  .map(t => `<a class="chip" href="../${t.bpm}-bpm/">${t.bpm} BPM</a>`).join('\n          ');
const otherDelay = (cur) => TEMPOS.filter(t => t.bpm !== cur)
  .map(t => `<a class="chip" href="../${t.bpm}-bpm/">${t.bpm} BPM</a>`).join('\n          ');

// ---- sitemap -------------------------------------------------------------
// Rewrite ONLY the bpm <url> entries (metronome + delay), leaving every other
// page (tool hubs, feel pages, sibling tools) untouched. Idempotent, and safe
// when other agents are editing the same sitemap concurrently.
function updateSitemap(urls) {
  const path = join(ROOT, 'sitemap.xml');
  let xml = readFileSync(path, 'utf8');
  // Strip any existing metronome/delay bpm url blocks.
  xml = xml.replace(/\n\s*<url>\s*<loc>https:\/\/pockettempo\.xyz\/(?:metronome|delay)\/\d+-bpm\/<\/loc>[\s\S]*?<\/url>/g, '');
  const block = urls.map(u => `  <url>\n    <loc>${u}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`).join('\n');
  xml = xml.replace(/\n?<\/urlset>\s*$/, '\n' + block + '\n</urlset>\n');
  writeFileSync(path, xml);
}

// ---- run -----------------------------------------------------------------
const written = { metronome: [], delay: [] };
const sitemapUrls = [];
for (const t of TEMPOS) {
  const mDir = join(ROOT, 'metronome', `${t.bpm}-bpm`);
  mkdirSync(mDir, { recursive: true });
  writeFileSync(join(mDir, 'index.html'), metronomePage(t));
  written.metronome.push(`/metronome/${t.bpm}-bpm/`);
  sitemapUrls.push(`${BASE}/metronome/${t.bpm}-bpm/`);

  const dDir = join(ROOT, 'delay', `${t.bpm}-bpm`);
  mkdirSync(dDir, { recursive: true });
  writeFileSync(join(dDir, 'index.html'), delayPage(t));
  written.delay.push(`/delay/${t.bpm}-bpm/`);
  sitemapUrls.push(`${BASE}/delay/${t.bpm}-bpm/`);
}
updateSitemap(sitemapUrls);

console.log(`Wrote ${written.metronome.length} metronome + ${written.delay.length} delay BPM pages (${TEMPOS.length} tempos).`);
console.log('Spot-check 128 BPM quarter delay =', fmtMs(msFor(128, 4, 1)), 'ms (expect 468.75)');
console.log('Sitemap bpm section rewritten:', sitemapUrls.length, 'urls.');
