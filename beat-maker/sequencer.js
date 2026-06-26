/*
 * Beat Maker — a 16-step drum sequencer with accurate Web Audio timing.
 *
 * Timing model is the same "two clocks" lookahead scheduler as the metronome
 * (Chris Wilson): a coarse setInterval wakes us every LOOKAHEAD ms, and on each
 * wake we schedule every 16th-note step that falls inside the next
 * SCHEDULE_AHEAD-second window directly on the AudioContext sample clock. The
 * audio hardware then fires each hit exactly on time, regardless of JS jitter.
 *
 * Drums are SYNTHESISED (oscillators + filtered noise) rather than loaded from
 * samples, so the whole tool is a few KB and loads instantly with zero deps.
 *
 * The full pattern (which cells are on, tempo, swing) lives in the URL, so any
 * groove is shareable just by copying the address bar.
 */
(function () {
  'use strict';

  const STEPS = 16;
  const LOOKAHEAD = 25;          // ms — scheduler wake interval
  const SCHEDULE_AHEAD = 0.12;   // s  — how far ahead we schedule hits

  // --- Drum kit (synthesised voices) --------------------------------------

  // One shared white-noise buffer, reused by every noise-based voice.
  let noiseBuffer = null;
  function getNoise(ctx) {
    if (!noiseBuffer) {
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 1, ctx.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    return noiseBuffer;
  }

  function noiseSource(ctx) {
    const src = ctx.createBufferSource();
    src.buffer = getNoise(ctx);
    return src;
  }

  function kick(ctx, t, out) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.11);
    gain.gain.setValueAtTime(1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 0.42);
  }

  function snare(ctx, t, out) {
    // Noise body
    const n = noiseSource(ctx);
    const nf = ctx.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = 1500;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.8, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    n.connect(nf).connect(ng).connect(out);
    n.start(t);
    n.stop(t + 0.2);
    // Tonal "crack"
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 190;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.6, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.connect(og).connect(out);
    osc.start(t);
    osc.stop(t + 0.12);
  }

  function hat(ctx, t, out, decay) {
    const n = noiseSource(ctx);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    n.connect(hp).connect(g).connect(out);
    n.start(t);
    n.stop(t + decay + 0.02);
  }
  function closedHat(ctx, t, out) { hat(ctx, t, out, 0.045); }
  function openHat(ctx, t, out) { hat(ctx, t, out, 0.32); }

  function clap(ctx, t, out) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1200;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    bp.connect(g).connect(out);
    // Three quick noise bursts + a tail = the classic clap "smear".
    const offsets = [0, 0.01, 0.02];
    offsets.forEach((off) => {
      const n = noiseSource(ctx);
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.0001, t + off);
      ng.gain.exponentialRampToValueAtTime(0.7, t + off + 0.001);
      ng.gain.exponentialRampToValueAtTime(0.001, t + off + 0.02);
      n.connect(ng).connect(bp);
      n.start(t + off);
      n.stop(t + off + 0.03);
    });
    g.gain.setValueAtTime(1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  }

  function tom(ctx, t, out) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.2);
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(out);
    osc.start(t);
    osc.stop(t + 0.3);
  }

  const KIT = [
    { id: 'kick',  name: 'Kick',  play: kick },
    { id: 'snare', name: 'Snare', play: snare },
    { id: 'chat',  name: 'Hat',   play: closedHat },
    { id: 'ohat',  name: 'Open',  play: openHat },
    { id: 'clap',  name: 'Clap',  play: clap },
    { id: 'tom',   name: 'Tom',   play: tom },
  ];
  const ROWS = KIT.length;

  // --- Built-in patterns (also great share-bait) --------------------------
  // Each is a ROWS-length array of 16-char step strings, row order = KIT.
  const PRESETS = {
    'four-floor': [
      '1000100010001000', // kick
      '0000100000001000', // snare
      '1010101010101010', // hat
      '0000000000000000', // open
      '0000000000000000', // clap
      '0000000000000000', // tom
    ],
    'boom-bap': [
      '1000001000100000',
      '0000100000001000',
      '1010101010101010',
      '0000000000000000',
      '0000100000001000',
      '0000000000000000',
    ],
    'trap': [
      '1000000010000010',
      '0000100000001000',
      '1010101110101011',
      '0000001000000000',
      '0000000000000000',
      '0000000000100000',
    ],
    'house': [
      '1000100010001000',
      '0000000000000000',
      '0010001000100010',
      '0010001000100010',
      '0000100000001000',
      '0000000000000000',
    ],
  };

  // --- State --------------------------------------------------------------

  const state = {
    audioCtx: null,
    isPlaying: false,
    bpm: 120,
    swing: 0,               // 0..0.6 — fraction of a 16th the off-beats slide late
    volume: 0.9,
    grid: emptyGrid(),      // grid[row][step] = boolean
    currentStep: 0,         // step index for the NEXT note to schedule
    nextNoteTime: 0,
    timerId: null,
    notesInQueue: [],       // {step, time} pending visual playhead
  };

  function emptyGrid() {
    return Array.from({ length: ROWS }, () => new Array(STEPS).fill(false));
  }

  // --- Audio scheduler ----------------------------------------------------

  function ensureContext() {
    if (!state.audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      state.audioCtx = new Ctx();
      state.master = state.audioCtx.createGain();
      state.master.connect(state.audioCtx.destination);
    }
    if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
    state.master.gain.value = state.volume;
    return state.audioCtx;
  }

  function scheduleStep(step, time) {
    for (let r = 0; r < ROWS; r++) {
      if (state.grid[r][step]) KIT[r].play(state.audioCtx, time, state.master);
    }
  }

  function advanceStep() {
    const secondsPer16th = (60.0 / state.bpm) / 4;
    state.currentStep = (state.currentStep + 1) % STEPS;
    // Swing: push the odd (off-beat) 16ths slightly later.
    const swingDelay = (state.currentStep % 2 === 1) ? secondsPer16th * state.swing : 0;
    state.nextNoteTime += secondsPer16th;
    state.pendingSwing = swingDelay;
  }

  function scheduler() {
    const ctx = state.audioCtx;
    while (state.nextNoteTime + (state.pendingSwing || 0) < ctx.currentTime + SCHEDULE_AHEAD) {
      const t = state.nextNoteTime + (state.pendingSwing || 0);
      scheduleStep(state.currentStep, t);
      state.notesInQueue.push({ step: state.currentStep, time: t });
      advanceStep();
    }
  }

  // --- Transport ----------------------------------------------------------

  function start() {
    if (state.isPlaying) return;
    const ctx = ensureContext();
    state.isPlaying = true;
    state.currentStep = 0;
    state.pendingSwing = 0;
    state.nextNoteTime = ctx.currentTime + 0.06;
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
    setPlayhead(-1);
    onTransportChange();
  }

  function toggle() { state.isPlaying ? stop() : start(); }

  // --- Playhead visuals ---------------------------------------------------

  function draw() {
    if (!state.isPlaying) return;
    const now = state.audioCtx.currentTime;
    let head = -1;
    while (state.notesInQueue.length && state.notesInQueue[0].time < now) {
      head = state.notesInQueue[0].step;
      state.notesInQueue.shift();
    }
    if (head >= 0) setPlayhead(head);
    requestAnimationFrame(draw);
  }

  // --- DOM ----------------------------------------------------------------

  const $ = (id) => document.getElementById(id);
  let cellEls = [];   // cellEls[row][step] = element

  function buildGrid() {
    const wrap = $('grid');
    wrap.innerHTML = '';
    cellEls = [];
    for (let r = 0; r < ROWS; r++) {
      const rowEl = document.createElement('div');
      rowEl.className = 'seq-row';

      const label = document.createElement('div');
      label.className = 'seq-label';
      label.textContent = KIT[r].name;
      rowEl.appendChild(label);

      const cells = document.createElement('div');
      cells.className = 'seq-cells';
      cellEls[r] = [];
      for (let s = 0; s < STEPS; s++) {
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'cell' + (s % 4 === 0 ? ' downbeat' : '');
        cell.setAttribute('aria-label', KIT[r].name + ' step ' + (s + 1));
        cell.setAttribute('aria-pressed', 'false');
        cell.dataset.row = r;
        cell.dataset.step = s;
        cells.appendChild(cell);
        cellEls[r].push(cell);
      }
      rowEl.appendChild(cells);
      wrap.appendChild(rowEl);
    }
    renderGrid();
  }

  function renderGrid() {
    for (let r = 0; r < ROWS; r++) {
      for (let s = 0; s < STEPS; s++) {
        const on = state.grid[r][s];
        cellEls[r][s].classList.toggle('on', on);
        cellEls[r][s].setAttribute('aria-pressed', String(on));
      }
    }
  }

  function setCell(r, s, on) {
    state.grid[r][s] = on;
    cellEls[r][s].classList.toggle('on', on);
    cellEls[r][s].setAttribute('aria-pressed', String(on));
    syncUrl();
  }

  let playheadCol = -1;
  function setPlayhead(step) {
    if (step === playheadCol) return;
    document.querySelectorAll('.cell.playing').forEach((c) => c.classList.remove('playing'));
    if (step >= 0) {
      for (let r = 0; r < ROWS; r++) cellEls[r][step].classList.add('playing');
    }
    playheadCol = step;
  }

  function onTransportChange() {
    const btn = $('play-toggle');
    btn.textContent = state.isPlaying ? 'Stop' : 'Play';
    btn.setAttribute('aria-pressed', String(state.isPlaying));
    btn.classList.toggle('playing', state.isPlaying);
  }

  // --- Tempo / swing ------------------------------------------------------

  function setBpm(value) {
    const bpm = Math.min(200, Math.max(50, Math.round(value) || 120));
    state.bpm = bpm;
    $('bpm-value').textContent = bpm;
    $('bpm-slider').value = bpm;
    syncUrl();
  }

  function setSwing(value) {
    state.swing = Math.min(0.6, Math.max(0, value));
    $('swing-value').textContent = Math.round(state.swing * 100) + '%';
    $('swing-slider').value = state.swing;
    syncUrl();
  }

  // --- URL encode / decode (shareable patterns) ---------------------------
  //
  // Each row's 16 steps pack into a 16-bit integer (step 0 = bit 0), printed
  // as 4 hex chars. ROWS rows -> ROWS*4 hex chars. Plus tempo & swing params.

  function encodePattern() {
    let out = '';
    for (let r = 0; r < ROWS; r++) {
      let bits = 0;
      for (let s = 0; s < STEPS; s++) if (state.grid[r][s]) bits |= (1 << s);
      out += bits.toString(16).padStart(4, '0');
    }
    return out;
  }

  function decodePattern(hex) {
    if (!hex || hex.length < ROWS * 4) return false;
    for (let r = 0; r < ROWS; r++) {
      const bits = parseInt(hex.substr(r * 4, 4), 16);
      if (Number.isNaN(bits)) return false;
      for (let s = 0; s < STEPS; s++) state.grid[r][s] = !!(bits & (1 << s));
    }
    return true;
  }

  function loadPreset(name) {
    const p = PRESETS[name];
    if (!p) return;
    for (let r = 0; r < ROWS; r++) {
      for (let s = 0; s < STEPS; s++) state.grid[r][s] = p[r][s] === '1';
    }
    renderGrid();
    syncUrl();
  }

  function clearGrid() {
    state.grid = emptyGrid();
    renderGrid();
    syncUrl();
  }

  // Reflect current state into the address bar without reloading, so the URL
  // is always a live, copy-pasteable share link.
  let urlTimer = null;
  function syncUrl() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(() => {
      const params = new URLSearchParams();
      params.set('p', encodePattern());
      params.set('t', String(state.bpm));
      if (state.swing > 0) params.set('s', state.swing.toFixed(2));
      history.replaceState(null, '', location.pathname + '?' + params.toString());
    }, 120);
  }

  function loadFromUrl() {
    const params = new URLSearchParams(location.search);
    const t = parseInt(params.get('t'), 10);
    if (!Number.isNaN(t)) setBpm(t);
    const s = parseFloat(params.get('s'));
    if (!Number.isNaN(s)) setSwing(s);
    if (decodePattern(params.get('p'))) return true;
    return false;
  }

  // --- Share --------------------------------------------------------------

  function share() {
    const url = location.href;
    const btn = $('share-btn');
    const done = () => {
      const old = btn.textContent;
      btn.textContent = 'Link copied!';
      setTimeout(() => { btn.textContent = old; }, 1600);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, done);
    } else {
      done();
    }
  }

  // --- Cell painting (click + drag) ---------------------------------------

  let painting = false;
  let paintValue = true;

  function cellFromEvent(e) {
    const el = e.target.closest('.cell');
    if (!el) return null;
    return { el, r: +el.dataset.row, s: +el.dataset.step };
  }

  function init() {
    setBpm(state.bpm);
    setSwing(state.swing);
    buildGrid();

    // Seed from URL, else drop in a classic beat so the page is never empty.
    if (!loadFromUrl()) {
      loadPreset('four-floor');
    } else {
      renderGrid();
    }

    $('play-toggle').addEventListener('click', toggle);
    $('clear-btn').addEventListener('click', clearGrid);
    $('share-btn').addEventListener('click', share);

    $('bpm-slider').addEventListener('input', (e) => setBpm(+e.target.value));
    $('swing-slider').addEventListener('input', (e) => setSwing(+e.target.value));
    $('volume').addEventListener('input', (e) => {
      state.volume = +e.target.value;
      if (state.master) state.master.gain.value = state.volume;
    });

    document.querySelectorAll('[data-preset]').forEach((b) => {
      b.addEventListener('click', () => loadPreset(b.dataset.preset));
    });

    const gridEl = $('grid');
    // Pointer events unify mouse + touch for click-and-drag painting.
    gridEl.addEventListener('pointerdown', (e) => {
      const hit = cellFromEvent(e);
      if (!hit) return;
      e.preventDefault();
      painting = true;
      paintValue = !state.grid[hit.r][hit.s];   // toggle, then paint that value
      setCell(hit.r, hit.s, paintValue);
    });
    gridEl.addEventListener('pointerover', (e) => {
      if (!painting) return;
      const hit = cellFromEvent(e);
      if (hit) setCell(hit.r, hit.s, paintValue);
    });
    window.addEventListener('pointerup', () => { painting = false; });

    // Spacebar = play/stop (ignore when focused on a control).
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !/^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) {
        e.preventDefault();
        toggle();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', init);

  // Small surface for debugging / tests.
  window.__beatmaker = { state, start, stop, encodePattern, decodePattern, KIT, STEPS };
})();
