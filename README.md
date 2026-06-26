# music·tools

Free, fast, fun web tools for music makers. Static site, no build step, deployed to GitHub Pages.

**Live:** https://alexfedosov.github.io/music-tools/

## Tools

- **Online Metronome** (`/`) — accurate Web Audio metronome: adjustable BPM (40–240), time signatures, downbeat accent, tap tempo, keyboard control.

## Stack

- Vanilla HTML/CSS/JS — zero dependencies, zero build step. Loads in well under a second.
- **Audio:** Web Audio API with a lookahead scheduler (clicks are scheduled on the audio hardware clock, never from `setInterval`), so timing never drifts.
- **Hosting:** GitHub Pages (free).
- **Analytics:** privacy-friendly, first-party. A tiny beacon (`assets/js/analytics.js`) writes one row per page view to our own Postgres (Neon) via the Data API. No cookies, no localStorage, no cross-site IDs, no IP stored, no full user-agent — just path, tool, referring host, coarse screen width, and mobile/desktop.

## Layout

```
index.html              Metronome (home page)
assets/css/site.css     Shared styles
assets/js/metronome.js  Metronome engine (Web Audio scheduler)
assets/js/analytics.js  Privacy-friendly beacon
assets/js/config.js     Runtime config (public insert-only analytics key)
.well-known/jwks.json   Public key the analytics Data API uses to verify the beacon token
sitemap.xml, robots.txt SEO
scripts/                Dev/ops one-offs (token minting)
```

## Analytics auth model

The beacon ships a long-lived JWT. It is **public on purpose** and maps to a Postgres role (`anonymous`) that has been granted **only `INSERT`** on the `page_views` table — it cannot read or modify anything. The signing private key lives in `secrets/` (gitignored). To rotate, re-run `node scripts/mint-analytics-token.mjs`, commit the new `.well-known/jwks.json`, and update `assets/js/config.js`.

## Adding a tool

Create `toolname/index.html`, reuse `assets/css/site.css`, set `window.ANALYTICS.tool` in its config, and add it to `sitemap.xml`. Keep it dependency-free and fast.
