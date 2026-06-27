/*
 * Tap Tempo — tap a key/button in rhythm, read the BPM.
 *
 * Detection model:
 *   We timestamp every tap with performance.now() (monotonic, ~ms precision).
 *   The BPM is the rolling average of the intervals between consecutive taps:
 *     bpm = 60000 / avg(interval_ms)
 *   We keep only the most recent WINDOW intervals so the reading tracks you if
 *   you speed up or slow down, instead of being dragged by old taps. If you
 *   pause longer than RESET_MS we assume you're starting a new tempo and clear.
 *
 * A small "stability" read-out uses the spread (coefficient of variation) of
 * the windowed intervals so you can tell a locked-in tap from a sloppy one.
 *
 * No audio is required to detect tempo, but an optional click on each tap makes
 * it feel responsive — scheduled on the Web Audio clock like the metronome.
 */
(function () {
  'use strict';

  const RESET_MS = 2000;   // gap (ms) after which we assume a fresh tempo
  const WINDOW = 8;        // number of recent intervals to average over
  const MIN_BPM = 20;
  const MAX_BPM = 400;

  const state = {
    taps: [],            // recent performance.now() timestamps
    bpm: null,           // last computed BPM (number) or null
    clickOn: true,
    audioCtx: null,
  };

  const $ = (id) => document.getElementById(id);

  // --- Optional tap click (Web Audio, same envelope idea as the metronome) ---

  function ensureContext() {
    if (!state.audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      state.audioCtx = new Ctx();
    }
    if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
    return state.audioCtx;
  }

  function playClick() {
    if (!state.clickOn) return;
    const ctx = ensureContext();
    if (!ctx) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.4, t + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  // --- Detection -----------------------------------------------------------

  function intervals() {
    const out = [];
    for (let i = 1; i < state.taps.length; i++) {
      out.push(state.taps[i] - state.taps[i - 1]);
    }
    return out;
  }

  // Coefficient of variation (stddev / mean) → a stability label.
  function stability(ivals) {
    if (ivals.length < 2) return null;
    const mean = ivals.reduce((a, b) => a + b, 0) / ivals.length;
    const variance = ivals.reduce((a, b) => a + (b - mean) * (b - mean), 0) / ivals.length;
    const cv = Math.sqrt(variance) / mean;
    if (cv < 0.02) return { label: 'Locked in', cls: 'great' };
    if (cv < 0.05) return { label: 'Steady', cls: 'good' };
    if (cv < 0.10) return { label: 'A little loose', cls: 'ok' };
    return { label: 'Keep tapping…', cls: 'meh' };
  }

  function tap() {
    const now = performance.now();

    // A long gap means: new tempo. Start fresh from this tap.
    if (state.taps.length && now - state.taps[state.taps.length - 1] > RESET_MS) {
      state.taps = [];
    }
    state.taps.push(now);
    // Keep one more timestamp than the interval window we average over.
    if (state.taps.length > WINDOW + 1) state.taps = state.taps.slice(-(WINDOW + 1));

    playClick();
    pulse();
    recompute();
  }

  function recompute() {
    const ivals = intervals();
    if (ivals.length < 1) {
      state.bpm = null;
      render();
      return;
    }
    const avg = ivals.reduce((a, b) => a + b, 0) / ivals.length;
    let bpm = 60000 / avg;
    if (!isFinite(bpm) || bpm < MIN_BPM || bpm > MAX_BPM) {
      // Out of musical range (double-tap or huge gap) — ignore this reading.
      state.bpm = null;
      render();
      return;
    }
    state.bpm = bpm;
    render(stability(ivals));
  }

  function reset() {
    state.taps = [];
    state.bpm = null;
    render();
    clearShareUrl();
  }

  // --- Rendering -----------------------------------------------------------

  function render(stab) {
    const tapCount = state.taps.length;
    const hasBpm = state.bpm != null;
    // Derive the integer and decimal parts from one value so they always agree
    // (e.g. 119.7 → "119" + ".7", never "120" + ".7").
    const fixed = hasBpm ? state.bpm.toFixed(1) : null;
    const intPart = hasBpm ? fixed.split('.')[0] : null;
    const rounded = hasBpm ? Math.round(state.bpm) : null;

    $('bpm-value').textContent = hasBpm ? intPart : '—';
    $('bpm-decimal').textContent = hasBpm ? '.' + fixed.split('.')[1] : '';

    $('tap-count').textContent = tapCount === 0
      ? 'Tap to begin'
      : tapCount === 1
        ? 'Tap again…'
        : tapCount + ' taps';

    const stabEl = $('stability');
    if (stab) {
      stabEl.textContent = stab.label;
      stabEl.className = 'stability ' + stab.cls;
    } else {
      stabEl.textContent = '';
      stabEl.className = 'stability';
    }

    const share = $('share');
    if (hasBpm) {
      share.hidden = false;
      // The metronome lives at /metronome/ (the hub is at the site root) and
      // reads ?bpm to seed its starting tempo.
      $('metro-link').href = '../metronome/?bpm=' + rounded;
      // The delay calculator reads the same ?bpm contract, so a tapped tempo
      // flows straight into "set your delay time".
      var delayLink = $('delay-link');
      if (delayLink) delayLink.href = '../delay/?bpm=' + rounded;
      updateShareUrl(rounded);
    } else {
      share.hidden = true;
    }

    $('reset-btn').disabled = tapCount === 0;
  }

  function pulse() {
    const btn = $('tap-pad');
    btn.classList.remove('hit');
    // Force reflow so the animation restarts on rapid taps.
    void btn.offsetWidth;
    btn.classList.add('hit');
  }

  // --- Shareable URL -------------------------------------------------------
  // Reflect the detected tempo into the URL (?bpm=NNN) without reloading, so
  // copying the address bar — or the Copy button — shares the exact tempo.

  function updateShareUrl(bpm) {
    try {
      const url = new URL(location.href);
      url.searchParams.set('bpm', bpm);
      history.replaceState(null, '', url);
    } catch (e) { /* no-op */ }
  }

  function clearShareUrl() {
    try {
      const url = new URL(location.href);
      url.searchParams.delete('bpm');
      history.replaceState(null, '', url);
    } catch (e) { /* no-op */ }
  }

  function copyLink() {
    const btn = $('copy-link');
    const text = location.href;
    const done = () => {
      const old = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = old; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => prompt('Copy this link:', text));
    } else {
      prompt('Copy this link:', text);
    }
  }

  // --- Init ----------------------------------------------------------------

  function init() {
    $('tap-pad').addEventListener('click', tap);
    $('reset-btn').addEventListener('click', reset);
    $('copy-link').addEventListener('click', copyLink);
    $('click-toggle').addEventListener('change', (e) => { state.clickOn = e.target.checked; });

    // Keyboard: any key taps, except Escape/Backspace which reset. We ignore
    // key auto-repeat so holding a key down doesn't spam taps.
    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      if (e.code === 'Escape' || e.code === 'Backspace') {
        e.preventDefault();
        reset();
        return;
      }
      // Let modifier combos (e.g. Cmd+R reload) through.
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      e.preventDefault();
      tap();
    });

    // If we arrived with ?bpm=NNN, show it as the starting reading so a shared
    // link lands on the right tempo. The first tap starts a fresh measurement.
    const params = new URLSearchParams(location.search);
    const seed = parseInt(params.get('bpm'), 10);
    if (seed >= MIN_BPM && seed <= MAX_BPM) {
      state.bpm = seed;
      render();
    } else {
      render();
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  // Tiny surface for debugging / tests.
  window.__tapTempo = { state, tap, reset, recompute };
})();
