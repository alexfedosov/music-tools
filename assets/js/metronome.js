/*
 * Online Metronome — accurate Web Audio timing.
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
 */
(function () {
  'use strict';

  const LOOKAHEAD = 25;          // ms — how often the scheduler wakes
  const SCHEDULE_AHEAD = 0.12;   // s  — how far ahead we schedule clicks

  const state = {
    audioCtx: null,
    isPlaying: false,
    bpm: 120,
    beatsPerBar: 4,
    accentFirst: true,
    volume: 0.9,
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

  // Schedule one click at AudioContext time `time`. Accented beats are higher
  // pitched and a touch louder so the downbeat is unmistakable.
  function scheduleClick(beat, time) {
    const ctx = state.audioCtx;
    const isAccent = state.accentFirst && beat === 0;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = isAccent ? 1500 : 1000;

    const peak = state.volume * (isAccent ? 1.0 : 0.6);
    // Short percussive envelope: fast attack, exponential decay (a "tick").
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(peak, time + 0.001);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);

    osc.start(time);
    osc.stop(time + 0.06);
  }

  function advanceNote() {
    const secondsPerBeat = 60.0 / state.bpm;
    state.nextNoteTime += secondsPerBeat;
    state.currentBeat = (state.currentBeat + 1) % state.beatsPerBar;
  }

  function scheduler() {
    const ctx = state.audioCtx;
    while (state.nextNoteTime < ctx.currentTime + SCHEDULE_AHEAD) {
      scheduleClick(state.currentBeat, state.nextNoteTime);
      state.notesInQueue.push({ beat: state.currentBeat, time: state.nextNoteTime });
      advanceNote();
    }
  }

  // --- Transport -----------------------------------------------------------

  function start() {
    if (state.isPlaying) return;
    const ctx = ensureContext();
    state.isPlaying = true;
    state.currentBeat = 0;
    state.nextNoteTime = ctx.currentTime + 0.05;
    scheduler();
    state.timerId = setInterval(scheduler, LOOKAHEAD);
    requestAnimationFrame(draw);
    onTransportChange();
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
  }

  function setBeatsPerBar(value) {
    state.beatsPerBar = Math.min(12, Math.max(1, value));
    state.currentBeat = 0;
    buildBeatDots();
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
    // Allow deep-linking a tempo, e.g. from the Tap Tempo tool: ?bpm=128
    const seed = parseInt(new URLSearchParams(location.search).get('bpm'), 10);
    setBpm(seed || state.bpm);
    buildBeatDots();

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

    // Spacebar = start/stop (skip when typing in a field).
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(e.target.tagName)) {
        e.preventDefault();
        toggle();
      }
    });

    // Pause audio scheduling sanity: stop on tab close handled by browser.
  }

  document.addEventListener('DOMContentLoaded', init);

  // Expose a tiny surface for debugging / tests.
  window.__metronome = { state, start, stop, setBpm };
})();
