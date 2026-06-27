/*
 * Privacy-friendly first-party analytics beacon.
 *
 * Records one row per page view into our own Neon/Postgres table via the
 * Data API. No cookies, no cross-site identifiers, no full user-agent string,
 * no IP stored by us. We keep only: path, which tool, the referring host (not
 * full URL), a coarse screen width bucket, a mobile/desktop flag, and a
 * new-vs-returning marker. Nothing here identifies a person.
 *
 * RETURNING-VISITOR SIGNAL (the sticky-tool data trigger — CRA-25):
 * We answer "which tools earn return visits?" with one first-party localStorage
 * entry (`pt_seen_tools`) that lists the tool ids this browser has already seen.
 * On each page view we emit visitor_kind = "new" | "returning" for the current
 * tool. It is per-tool (seeing the metronome doesn't mark you returning on the
 * sequencer), holds no id/timestamp/PII, and has zero value off our own site —
 * it only ever distinguishes "first time on this tool" from "been here before".
 * Falls back to null when storage is unavailable (private mode), so the beacon
 * still records the view.
 *
 * Config is provided by window.ANALYTICS = { endpoint, token, tool }.
 * `token` is a long-lived, INSERT-ONLY bearer token: the database role it
 * maps to can only append rows to page_views and can read nothing, so it is
 * safe to ship in client code.
 *
 * CUSTOM EVENTS (the Feel Wedge validation signal — CRA-14):
 * We have no event/feel columns and don't want a DB migration, so we overload
 * the existing text columns: an event row sets `path` to "/e/<event>[/<detail>]"
 * and `tool` to the detail (e.g. the feel id). That keeps the insert-only token
 * valid and lets the readout query split events from page views by path prefix.
 *   window.track('feel_select', 'dilla')            // every active selection
 *   window.trackOncePerSession('feel_engaged','x')  // once/session — KILL metric
 * The CRA-13 kill metric = count(feel_engaged) / count(feel_session): the share
 * of feel-aware sessions that actually touch the feel selector.
 */
(function () {
  'use strict';
  var cfg = window.ANALYTICS || {};
  // `enabled: false` drops analytics entirely (CEO directive, CRA-25 2026-06-27):
  // no page-view beacon, and track()/trackOncePerSession() become no-ops.
  if (cfg.enabled === false || !cfg.endpoint) { window.track = window.trackOncePerSession = function () {}; return; }

  function referrerHost() {
    try {
      if (!document.referrer) return null;
      var h = new URL(document.referrer).hostname;
      // Don't record same-site navigation as a referrer.
      return h === location.hostname ? null : h;
    } catch (e) { return null; }
  }

  var uaKind = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';
  var screenW = window.screen ? window.screen.width : null;

  // Returning-visitor signal: has this browser seen THIS tool before? Reads and
  // updates a single first-party localStorage list of tool ids. Returns 'new'
  // the first time a tool is seen, 'returning' after that, null if storage is
  // blocked. No identifier is ever stored — just which tools have been visited.
  function visitorKind(tool) {
    if (!tool) return null;
    try {
      if (!window.localStorage) return null;
      var KEY = 'pt_seen_tools';
      var seen = (localStorage.getItem(KEY) || '').split(',').filter(Boolean);
      if (seen.indexOf(tool) !== -1) return 'returning';
      seen.push(tool);
      if (seen.length > 60) seen = seen.slice(seen.length - 60); // bound growth
      localStorage.setItem(KEY, seen.join(','));
      return 'new';
    } catch (e) { return null; } // private mode / storage disabled
  }

  // Low-level: append one row. Always swallows errors — analytics must never
  // break the page.
  function send(row) {
    try {
      var headers = { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
      if (cfg.token) headers['Authorization'] = 'Bearer ' + cfg.token;
      fetch(cfg.endpoint, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(row),
        keepalive: true,
        mode: 'cors'
      }).catch(function () {});
    } catch (e) { /* no-op */ }
  }

  // Public: record a custom event (e.g. a feel selection).
  window.track = function (event, detail) {
    if (!event) return;
    send({
      path: '/e/' + event + (detail ? '/' + detail : ''),
      tool: detail || cfg.tool || null,
      referrer_host: referrerHost(),
      screen_w: screenW,
      ua_kind: uaKind
    });
  };

  // Public: record a custom event at most once per browser session — used to
  // turn raw inserts into a per-session ratio without a session-id column.
  window.trackOncePerSession = function (event, detail) {
    try {
      var k = 'pt_ev_' + event;
      if (window.sessionStorage && sessionStorage.getItem(k)) return;
      if (window.sessionStorage) sessionStorage.setItem(k, '1');
    } catch (e) { /* private mode — fall through and just send */ }
    window.track(event, detail);
  };

  // Auto page view on load.
  send({
    path: location.pathname,
    tool: cfg.tool || null,
    referrer_host: referrerHost(),
    screen_w: screenW,
    ua_kind: uaKind,
    visitor_kind: visitorKind(cfg.tool || null)
  });
})();
