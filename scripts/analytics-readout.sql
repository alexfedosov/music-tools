-- Pocket Tempo — analytics readout (CRA-25)
-- ==========================================================================
-- The board-facing queries that answer the two questions behind the
-- "win cheap traffic first (a)  ->  invest in a sticky/return tool (b)" pivot:
--
--   1. Which tools earn TRAFFIC?        (per-tool pageviews)
--   2. Which tools earn RETURN VISITS?  (per-tool new-vs-returning share)
--
-- Run against Neon project `music-tools-analytics` (id bold-leaf-00726198),
-- branch `main`, database `neondb`, with OWNER creds (the public beacon token
-- is INSERT-ONLY and cannot read). e.g. Neon SQL Editor, or the Neon MCP
-- run_sql tool, or psql with the neondb_owner connection string.
--
-- DATA MODEL (see assets/js/analytics.js):
--   path           text  — URL path, OR '/e/<event>[/<detail>]' for custom events
--   tool           text  — tool id: 'metronome','tap-tempo','beat-maker','delay',
--                          'chord-scale-explorer','feel:library','feel:dilla',...,
--                          'metronome:120bpm',... , 'hub'
--   referrer_host  text  — referring hostname only (no full URL), null if same-site
--   screen_w       int   — screen width px (coarse device signal)
--   ua_kind        text  — 'mobile' | 'desktop'
--   visitor_kind   text  — 'new' | 'returning' for THIS tool, null if storage blocked
--                          (added in CRA-25; rows before that are NULL)
--
-- NOTE: real page views and overloaded custom-event rows share the table.
-- Event rows have path LIKE '/e/%' — every traffic query below excludes them.
-- ==========================================================================


-- 0. HEALTH CHECK — is the beacon alive and how fresh is the data?
--    (After the CRA-10 JWKS restore this should show a recent `latest`.)
SELECT
  count(*)                                          AS total_rows,
  count(*) FILTER (WHERE path NOT LIKE '/e/%')       AS pageviews,
  count(*) FILTER (WHERE path LIKE '/e/%')           AS events,
  count(*) FILTER (WHERE visitor_kind IS NOT NULL)   AS rows_with_visitor_kind,
  min(created_at)                                    AS earliest,
  max(created_at)                                    AS latest
FROM page_views;


-- 1. PER-TOOL PAGEVIEWS — which tools earn traffic? (last 30 days)
SELECT
  tool,
  count(*)                                  AS pageviews,
  count(*) FILTER (WHERE ua_kind='mobile')  AS mobile,
  count(DISTINCT referrer_host)             AS distinct_referrers
FROM page_views
WHERE path NOT LIKE '/e/%'
  AND created_at >= now() - interval '30 days'
GROUP BY tool
ORDER BY pageviews DESC;


-- 2. PER-TOOL RETURNING-vs-NEW — which tools earn return visits? (last 30 days)
--    returning_pct is computed over rows that HAVE a visitor_kind, so older
--    NULL rows and private-mode views don't distort the ratio.
SELECT
  tool,
  count(*)                                              AS views,
  count(*) FILTER (WHERE visitor_kind='new')            AS new_views,
  count(*) FILTER (WHERE visitor_kind='returning')      AS returning_views,
  round(
    100.0 * count(*) FILTER (WHERE visitor_kind='returning')
    / nullif(count(*) FILTER (WHERE visitor_kind IN ('new','returning')), 0)
  , 1)                                                  AS returning_pct
FROM page_views
WHERE path NOT LIKE '/e/%'
  AND created_at >= now() - interval '30 days'
GROUP BY tool
ORDER BY returning_pct DESC NULLS LAST, views DESC;


-- 3. THE (a) -> (b) PIVOT TRIGGER — traffic AND stickiness side by side.
--    The signal to invest a build-block in a sticky/return tool (Ear Trainer)
--    fires when a tool clears BOTH floors: enough traffic to matter AND a
--    meaningful share of return visits. Thresholds below are STARTING POINTS
--    (>=100 views, >=20% returning over 30d) — retune once we have real volume.
--    Also gates CRA-23 (monetization timing): monetize the tools that prove
--    both reach and stickiness first.
WITH t AS (
  SELECT
    tool,
    count(*)                                            AS views,
    count(*) FILTER (WHERE visitor_kind='returning')    AS returning_views,
    count(*) FILTER (WHERE visitor_kind IN ('new','returning')) AS known_views
  FROM page_views
  WHERE path NOT LIKE '/e/%'
    AND created_at >= now() - interval '30 days'
  GROUP BY tool
)
SELECT
  tool,
  views,
  returning_views,
  round(100.0 * returning_views / nullif(known_views, 0), 1) AS returning_pct,
  (views >= 100
   AND returning_views::numeric / nullif(known_views, 0) >= 0.20) AS pivot_signal
FROM t
ORDER BY pivot_signal DESC NULLS LAST, returning_pct DESC NULLS LAST, views DESC;


-- 4. CHORD CO-PILOT KILL METRIC (CRA-34) — is it a CREATION tool, or a toy?
--    The co-pilot (chords/, tool id 'chord-copilot') is the flagship "co-pilot"
--    bet: encode harmony so a novice writes a progression they're proud to
--    share. Visionary owns the threshold; the build emits the events so it's
--    measurable from day one.
--
--    Events (overloaded event rows, path = '/e/<event>[/<detail>]'):
--      chord_session          once/session on load   — the DENOMINATOR
--      play_pressed           once/session on Play    — ACTIVATION numerator
--      progression_completed  once/session, full loop — COMPLETION numerator
--    The once-per-session rows carry NO detail, so path matches EXACTLY
--    '/e/<event>' (the raw, detail-bearing rows like '/e/play_pressed/happy'
--    are the per-mood breakdown in query 5 and are excluded here).
--
--    KILL CRITERIA (after ~2 weeks real traffic):
--      activation (Play)        >= 40%   AND
--      progression-complete     >= 15%
--    else the co-pilot framing failed (used as a reference, not to create).
WITH ev AS (
  SELECT
    count(*) FILTER (WHERE path = '/e/chord_session')         AS sessions,
    count(*) FILTER (WHERE path = '/e/play_pressed')          AS activations,
    count(*) FILTER (WHERE path = '/e/progression_completed')  AS completions
  FROM page_views
  WHERE created_at >= now() - interval '30 days'
)
SELECT
  sessions,
  activations,
  completions,
  round(100.0 * activations / nullif(sessions, 0), 1) AS activation_pct,
  round(100.0 * completions / nullif(sessions, 0), 1) AS completion_pct,
  (activations::numeric / nullif(sessions, 0) >= 0.40
   AND completions::numeric / nullif(sessions, 0) >= 0.15) AS copilot_passes
FROM ev;


-- 5. CHORD CO-PILOT — engagement breakdown by mood + secondary events.
--    Which moods get picked, and do people use Surprise / share / cross-nav?
--    Reads the detail-bearing raw rows (e.g. '/e/play_pressed/happy').
SELECT
  split_part(path, '/', 3)               AS event,
  coalesce(nullif(split_part(path, '/', 4), ''), '(all)') AS detail,
  count(*)                               AS hits
FROM page_views
WHERE path LIKE '/e/%'
  AND split_part(path, '/', 3) IN
      ('play_pressed','progression_completed','surprise_me_used',
       'share_copied','cross_nav_click','chord_session')
  AND created_at >= now() - interval '30 days'
GROUP BY 1, 2
ORDER BY 1, hits DESC;
