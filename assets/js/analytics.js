/*
 * Privacy-friendly first-party analytics beacon.
 *
 * Records one row per page view into our own Neon/Postgres table via the
 * Data API. No cookies, no localStorage, no cross-site identifiers, no full
 * user-agent string, no IP stored by us. We keep only: path, which tool,
 * the referring host (not full URL), a coarse screen width bucket, and a
 * mobile/desktop flag. Nothing here identifies a person.
 *
 * Config is provided by window.ANALYTICS = { endpoint, token, tool }.
 * `token` is a long-lived, INSERT-ONLY bearer token: the database role it
 * maps to can only append rows to page_views and can read nothing, so it is
 * safe to ship in client code.
 */
(function () {
  'use strict';
  var cfg = window.ANALYTICS || {};
  if (!cfg.endpoint) return;

  function referrerHost() {
    try {
      if (!document.referrer) return null;
      var h = new URL(document.referrer).hostname;
      // Don't record same-site navigation as a referrer.
      return h === location.hostname ? null : h;
    } catch (e) { return null; }
  }

  try {
    var payload = {
      path: location.pathname,
      tool: cfg.tool || null,
      referrer_host: referrerHost(),
      screen_w: window.screen ? window.screen.width : null,
      ua_kind: /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop'
    };
    var headers = { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' };
    if (cfg.token) headers['Authorization'] = 'Bearer ' + cfg.token;

    fetch(cfg.endpoint, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(payload),
      keepalive: true,
      mode: 'cors'
    }).catch(function () { /* analytics must never break the page */ });
  } catch (e) { /* no-op */ }
})();
