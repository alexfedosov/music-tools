/*
 * Online Metronome — accurate Web Audio timing, now with THE FEEL LIBRARY.
 *
 * Timing model (the important part):
 * We do NOT play clicks from setInterval/setTimeout — those drift and stall
 * under load. Instead we use the "two clocks" pattern (Chris Wilson):
 *   - A coarse setInterval wakes us up every LOOKAHEAD ms.
 *   - On each wake we look SCHEDULE_AHEAD seconds into the future and schedule
 *     every click that falls in that window directly on the AudioContext's
 *     sample-accurate clock via oscillator.start(time).
 * The audio hardware then fires each click at exactly the requested time,
 * independent of JS timer jitter. The UI is updated separately on rAF.
 *
 * THE FEEL LAYER (our wedge): instead of one click per beat, each beat now
 * schedules the steps of the selected "feel" (see feels.js) at their
 * micro-timed positions within the beat, optionally over a steady reference
 * pulse. That's how the metronome can groove like J Dilla or the Purdie
 * shuffle instead of a robot grid — all on the same sample-accurate clock.
 */
import { FEELS, FEEL_BY_ID } from './feels.js';

(function () {
  'use strict';

  const LOOKAHEAD = 25;          // ms — how often the scheduler wakes
  const SCHEDULE_AHEAD = 0.14;   // s  — how far ahead we schedule clicks

  const state = {
    audioCtx: null,
    isPlaying: false,
    bpm: 120,
    beatsPerBar: 4,
    accentFirst: true,
    volume: 0.9,
    feel: FEEL_BY_ID.straight,
    pulseOn: false,        // steady reference quarter under the feel
    currentBeat: 0,        // beat index within the bar for the NEXT note
    nextNoteTime: 0,       // AudioContext time of the next note (s)
    timerId: null,
    notesInQueue: [],      // {beat, time} pending visual rendering
  };

  // --- Audio ---------------------------------------------------------------

  function ensureContext() {
    if (!state.audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      state.audioCtx = new Ctx();
    }
    // Browsers start contexts suspended until a user gesture.
    if (state.audioCtx.state === 'suspended') {
      state.audioCtx.resume();
    }
    return state.audioCtx;
  }

  // Schedule one tick at AudioContext time `time`. Short percussive envelope:
  // fast attack, exponential decay (a "tick").
  function schedTick(time, freq, gain) {
    const ctx = state.audioCtx;
    if (gain <= 0.0001) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(gain, time + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.start(time);
    osc.stop(time + 0.06);
  }

  // Schedule a whole beat: the optional steady pulse plus every micro-timed
  // step of the current feel. `beatTime` is the exact grid time of the beat.
  function scheduleBeat(beatIndex, beatTime) {
    const spb = 60.0 / state.bpm;
    const feel = state.feel;
    const usePulse = state.pulseOn || feel.pulse;
    const accentDown = state.accentFirst && beatIndex === 0;

    // Steady reference pulse — a low woodblock tick dead on the grid, so you
    // can hear the feel lean against true time (vital for drag/push feels).
    if (usePulse) {
      schedTick(beatTime, accentDown ? 920 : 760, state.volume * 0.5);
    }

    // The feel voice.
    for (let i = 0; i < feel.steps.length; i++) {
      const s = feel.steps[i];
      const t = beatTime + (s.t + feel.drag) * spb;
      const isBeatDown = s.t === 0;
      let freq, gainMul;
      if (isBeatDown && accentDown) { freq = 1500; gainMul = 1.0; }
      else if (isBeatDown) { freq = 1000; gainMul = 0.9; }
      else { freq = 1400; gainMul = 0.8; }   // in-between subdivisions
      schedTick(t, freq, state.volume * s.g * gainMul);
    }

    // One visual marker per beat (we light dots on beats, not subdivisions).
    state.notesInQueue.push({ beat: beatIndex, time: beatTime });
  }

  function advanceNote() {
    const secondsPerBeat = 60.0 / state.bpm;
    state.nextNoteTime += secondsPerBeat;
    state.currentBeat = (state.currentBeat + 1) % state.beatsPerBar;
  }

  function scheduler() {
    const ctx = state.audioCtx;
    while (state.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
      scheduleBeat(state.currentBeat, state.nextNoteTime);
      advanceNote();
    }
  }

  // --- Transport -----------------------------------------------------------

  function start() {
    if (state.isPlaying) return;
    const ctx = ensureContext();
    state.isPlaying = true;
    state.currentBeat = 0;
    state.nextNoteTime = ctx.currentTime + 0.08;
    scheduler();
    state.timerId = setInterval(scheduler, LOOKAHEAD);
    requestAnimationFrame(draw);
    onTransportChange();
    if (state.feel.id !== 'straight' && window.track) {
      window.track('feel_play', state.feel.id);
    }
  }

  function stop() {
    if (!state.isPlaying) return;
    state.isPlaying = false;
    clearInterval(state.timerId);
    state.timerId = null;
    state.notesInQueue = [];
    setActiveBeat(-1);
    onTransportChange();
  }

  function toggle() {
    state.isPlaying ? stop() : start();
  }

  // --- Visuals -------------------------------------------------------------

  let lastDrawnBeat = -1;
  function draw() {
    if (!state.isPlaying) return;
    const now = state.audioCtx.currentTime;
    // Drop notes that already played and light up the most recent one.
    while (state.notesInQueue.length && state.notesInQueue[0].time < now) {
      lastDrawnBeat = state.notesInQueue[0].beat;
      state.notesInQueue.shift();
      setActiveBeat(lastDrawnBeat);
    }
    requestAnimationFrame(draw);
  }

  // --- DOM wiring ----------------------------------------------------------

  const $ = (id) => document.getElementById(id);
  let beatDots = [];

  function buildBeatDots() {
    const row = $('beat-indicator');
    row.innerHTML = '';
    beatDots = [];
    for (let i = 0; i < state.beatsPerBar; i++) {
      const dot = document.createElement('span');
      dot.className = 'beat-dot' + (i === 0 && state.accentFirst ? ' accent' : '');
      dot.setAttribute('aria-hidden', 'true');
      row.appendChild(dot);
      beatDots.push(dot);
    }
  }

  function setActiveBeat(idx) {
    beatDots.forEach((d, i) => d.classList.toggle('active', i === idx));
  }

  function onTransportChange() {
    const btn = $('play-toggle');
    btn.textContent = state.isPlaying ? 'Stop' : 'Start';
    btn.setAttribute('aria-pressed', String(state.isPlaying));
    btn.classList.toggle('playing', state.isPlaying);
  }

  function setBpm(value) {
    const bpm = Math.min(240, Math.max(40, Math.round(value) || 120));
    state.bpm = bpm;
    $('bpm-value').textContent = bpm;
    $('bpm-slider').value = bpm;
    syncShareUrl();
  }

  function setBeatsPerBar(value) {
    state.beatsPerBar = Math.min(12, Math.max(1, value));
    state.currentBeat = 0;
    buildBeatDots();
    syncShareUrl();
  }

  // --- Feels ---------------------------------------------------------------

  function buildFeelChips() {
    const wrap = $('feel-chips');
    if (!wrap) return;
    wrap.innerHTML = '';
    FEELS.forEach((feel) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'feel-chip';
      btn.dataset.feel = feel.id;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.innerHTML = '<span class="feel-chip__emoji" aria-hidden="true">' + feel.emoji +
        '</span><span class="feel-chip__name">' + feel.name + '</span>';
      btn.style.setProperty('--feel-color', feel.color);
      btn.addEventListener('click', () => selectFeel(feel.id, true));
      wrap.appendChild(btn);
    });
  }

  function selectFeel(id, userInitiated) {
    const feel = FEEL_BY_ID[id] || FEEL_BY_ID.straight;
    state.feel = feel;
    // Drag/push feels need the reference pulse to be audible; default it on for
    // those, but respect a manual pulse toggle once the user touches it.
    if (!pulseTouched) state.pulseOn = !!feel.pulse;

    // UI: chips
    document.querySelectorAll('.feel-chip').forEach((c) => {
      const on = c.dataset.feel === id;
      c.classList.toggle('active', on);
      c.setAttribute('aria-checked', String(on));
    });
    // UI: description + pulse checkbox
    const desc = $('feel-desc');
    if (desc) {
      desc.innerHTML = '<strong>' + feel.name + '</strong> — ' + feel.tagline +
        (feel.id === 'straight' ? '' :
          ' <a class="feel-desc__link" href="' + feelPageHref(feel) + '">About this feel →</a>');
    }
    const pulseBox = $('pulse-toggle');
    if (pulseBox) pulseBox.checked = state.pulseOn;

    syncShareUrl();

    if (userInitiated) {
      if (window.track) window.track('feel_select', id);
      // Session-deduped engagement signal — the CRA-13 kill metric numerator.
      if (window.trackOncePerSession) window.trackOncePerSession('feel_engaged', id);
    }
  }

  function feelPageHref(feel) {
    if (feel.id === 'straight') return '../feel/';
    return '../feel/' + feel.id + '/';
  }

  let pulseTouched = false;

  // --- Shareable URL state -------------------------------------------------

  function currentStateUrl() {
    const base = location.origin + location.pathname;
    const p = new URLSearchParams();
    if (state.feel.id !== 'straight') p.set('feel', state.feel.id);
    p.set('bpm', state.bpm);
    if (state.beatsPerBar !== 4) p.set('sig', state.beatsPerBar);
    const qs = p.toString();
    return qs ? base + '?' + qs : base;
  }

  function syncShareUrl() {
    const url = currentStateUrl();
    // Keep the address bar in sync so a plain copy-paste shares the exact feel.
    try { history.replaceState(null, '', url); } catch (e) { /* file:// etc. */ }
    // Point the Copy-link button + X share at the live state.
    const copyBtn = document.querySelector('[data-copy-link]');
    if (copyBtn) copyBtn.setAttribute('data-copy-link', url);
    const x = document.querySelector('[data-share-x]');
    if (x) {
      const feel = state.feel;
      const text = feel.id === 'straight'
        ? 'Free online metronome with rock-solid timing'
        : 'Practising the ' + feel.name + ' feel on this free metronome 🥁';
      x.setAttribute('href',
        'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) +
        '&url=' + encodeURIComponent(url));
    }
  }

  // --- Tap tempo -----------------------------------------------------------

  let tapTimes = [];
  function tap() {
    const now = performance.now();
    tapTimes = tapTimes.filter((t) => now - t < 2000); // forget stale taps
    tapTimes.push(now);
    if (tapTimes.length >= 2) {
      const intervals = [];
      for (let i = 1; i < tapTimes.length; i++) intervals.push(tapTimes[i] - tapTimes[i - 1]);
      const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      setBpm(60000 / avg);
    }
  }

  function init() {
    const params = new URLSearchParams(location.search);

    buildBeatDots();
    buildFeelChips();

    // Deep-link state: ?feel=dilla&bpm=92&sig=4 (also from the Tap Tempo tool).
    const sigSeed = parseInt(params.get('sig'), 10);
    if (sigSeed >= 1 && sigSeed <= 12) {
      state.beatsPerBar = sigSeed;
      const sel = $('time-sig');
      if (sel) sel.value = String(sigSeed);
      buildBeatDots();
    }
    const feelSeed = params.get('feel');
    // URL-seeded feel is PASSIVE (not counted as an active selector touch).
    selectFeel(feelSeed && FEEL_BY_ID[feelSeed] ? feelSeed : 'straight', false);

    const bpmSeed = parseInt(params.get('bpm'), 10);
    setBpm(bpmSeed || (params.get('feel') && state.feel.defaultBpm) || state.bpm);

    $('play-toggle').addEventListener('click', toggle);
    $('bpm-slider').addEventListener('input', (e) => setBpm(+e.target.value));
    $('bpm-decr').addEventListener('click', () => setBpm(state.bpm - 1));
    $('bpm-incr').addEventListener('click', () => setBpm(state.bpm + 1));
    $('tap-tempo').addEventListener('click', tap);

    $('time-sig').addEventListener('change', (e) => setBeatsPerBar(+e.target.value));
    $('accent-toggle').addEventListener('change', (e) => {
      state.accentFirst = e.target.checked;
      buildBeatDots();
    });
    $('volume').addEventListener('input', (e) => { state.volume = +e.target.value; });

    const pulseBox = $('pulse-toggle');
    if (pulseBox) {
      pulseBox.addEventListener('change', (e) => {
        pulseTouched = true;
        state.pulseOn = e.target.checked;
      });
    }

    // Spacebar = start/stop (skip when typing in a field).
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) {
        e.preventDefault();
        toggle();
      }
    });

    // Denominator for the CRA-13 kill metric: one feel-aware session.
    if (window.trackOncePerSession) window.trackOncePerSession('feel_session', state.feel.id);
  }

  document.addEventListener('DOMContentLoaded', init);

  // Expose a tiny surface for debugging / tests.
  window.__metronome = { state, start, stop, setBpm, selectFeel, currentStateUrl };
})();
