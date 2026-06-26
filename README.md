# music·tools

Free, fast, fun web tools for music makers. Static site, no build step, deployed to GitHub Pages.

**Live:** https://alexfedosov.github.io/music-tools/

## Tools

- **Tools hub** (`/`) — the landing page: lists every tool, the SEO + navigation hub, and the tip jar.
- **Online Metronome** (`/metronome/`) — accurate Web Audio metronome: adjustable BPM (40–240), time signatures, downbeat accent, tap tempo, keyboard control. Accepts `?bpm=NNN` to deep-link a tempo.
- **Tap Tempo** (`/tap-tempo/`) — tap a key or button in time to detect a song's BPM. Rolling-average detection with a stability read-out, reset, shareable `?bpm=NNN` link, and one-click hand-off to the metronome.
- **Beat Maker** (`/beat-maker/`) — a 16-step drum machine: 6 synthesised drum voices (kick, snare, hat, open hat, clap, tom), adjustable tempo & swing, lookahead-scheduled timing, click-and-drag painting, built-in presets, and a fully shareable pattern encoded in the URL (`?p=…&t=BPM&s=swing`).
- **Chord & Scale Explorer** (`/chords/`) — pick any key + scale/mode and see the notes and diatonic chords (triads or 7ths) with roman numerals; click to hear them.

## Stack

- Vanilla HTML/CSS/JS — zero dependencies, zero build step. Loads in well under a second.
- **Audio:** Web Audio API with a lookahead scheduler (clicks are scheduled on the audio hardware clock, never from `setInterval`), so timing never drifts.
- **Hosting:** GitHub Pages (free).
- **Analytics:** privacy-friendly, first-party. A tiny beacon (`assets/js/analytics.js`) writes one row per page view to our own Postgres (Neon) via the Data API. No cookies, no localStorage, no cross-site IDs, no IP stored, no full user-agent — just path, tool, referring host, coarse screen width, and mobile/desktop.

## Growth & monetization (CRA-6)

- **Hub** at `/` is the SEO + navigation home; each tool lives in its own folder and links back to it.
- **Share hooks:** `assets/js/share.js` powers the "Copy link" chips; tools also expose native share links (X intent / shareable URLs). Every page has Open Graph + Twitter `summary_large_image` cards.
- **Social images:** pre-rendered 1200×630 cards live in `assets/og/`. Regenerate from `scripts/og-template.html` (render at 1200×630 and screenshot) and re-wire them into tool pages with `node scripts/wire-og-images.mjs` (idempotent).
- **Tip jar:** set `window.SITE.tipJarUrl` in `assets/js/config.js` to a Ko-fi / Buy Me a Coffee / GitHub Sponsors / PayPal.me URL. The tip-jar buttons stay hidden until it's set, so we never ship a broken link. (Account choice is a CEO decision — see CRA-6.)
- **SEO:** per-page titles/descriptions, canonicals, JSON-LD (`WebSite` + `ItemList` on the hub, `WebApplication` + `BreadcrumbList` on tools), `sitemap.xml`, `robots.txt`.

## Layout

```
index.html              Tools hub (home page)
metronome/index.html    Online Metronome
tap-tempo/index.html    Tap Tempo tool
beat-maker/index.html   Beat Maker tool (page)
beat-maker/sequencer.js Beat Maker engine (Web Audio step sequencer)
beat-maker/config.js    Beat Maker analytics config
chords/index.html       Chord & Scale Explorer
chords/explorer.css     Chord & Scale Explorer styles
assets/css/site.css     Shared styles
assets/js/metronome.js  Metronome engine (Web Audio scheduler)
assets/js/tap-tempo.js  Tap Tempo engine (rolling-average BPM detection)
assets/js/theory.js     Music-theory helpers (scales/chords)
assets/js/explorer.js   Chord & Scale Explorer UI
assets/js/share.js      Copy-link + tip-jar wiring (shared)
assets/js/analytics.js  Privacy-friendly beacon
assets/js/config.js     Runtime config: window.SITE + window.ANALYTICS (public insert-only key)
assets/og/*.png         Pre-rendered 1200×630 social cards
.well-known/jwks.json   Public key the analytics Data API uses to verify the beacon token
sitemap.xml, robots.txt SEO
scripts/                Dev/ops one-offs (token minting, OG card template + wiring)
```

## Analytics auth model

The beacon ships a long-lived JWT. It is **public on purpose** and maps to a Postgres role (`anonymous`) that has been granted **only `INSERT`** on the `page_views` table — it cannot read or modify anything. The signing private key lives in `secrets/` (gitignored). To rotate, re-run `node scripts/mint-analytics-token.mjs`, commit the new `.well-known/jwks.json`, and update `assets/js/config.js`.

Each page tags its own view by setting `window.ANALYTICS.tool` inline after loading `config.js` (e.g. `window.ANALYTICS.tool = "metronome"`).

## Adding a tool

1. Create `toolname/index.html`, reuse `assets/css/site.css`, and load `../assets/js/config.js` then set `window.ANALYTICS.tool = "toolname"` inline.
2. Add OG/Twitter meta, a canonical, and JSON-LD. Generate a social card via `scripts/og-template.html`, save it to `assets/og/toolname.png`, and add the page to `scripts/wire-og-images.mjs`.
3. Add a card to the hub (`index.html`) and a `<url>` to `sitemap.xml`. Load `../assets/js/share.js` for the copy-link + tip-jar chips. Keep it dependency-free and fast.
