/*
 * Chord Progression Co-pilot — UI, audio, sharing, analytics.
 *
 * The harmony "brain" lives in copilot-harmony.js (pure + unit-tested): it owns
 * the mood→key map, the curated starter progressions, the one-word function
 * labels, and the ranked "good next chord" suggestions. theory.js owns correct
 * diatonic chords (spelling, roman numerals, MIDI). This file is the shell that
 * wires those into a screen: it renders slots, plays block chords via Web Audio,
 * keeps the URL shareable, and fires the CRA-25 analytics events.
 *
 * Degrees are 1-based here to match copilot-harmony.js (1 = tonic … 7 = leading
 * tone). A slot holds a degree (1..7) or null when empty.
 *
 * ANALYTICS (CRA-25): events go through window.track / window.trackOncePer-
 * Session, exactly like the Feel Library. Analytics is currently gated off
 * (config.js enabled:false, CEO's CRA-25 pause) so these are no-ops today — but
 * the wiring is COMPLETE and every event fires the instant analytics is
 * re-enabled. Kill metrics (scripts/analytics-readout.sql):
 *   activation = count(play_pressed)          / count(chord_session)   [≥40%]
 *   completion = count(progression_completed) / count(chord_session)   [≥15%]
 */
(function () {
  'use strict';
  var T = window.Theory;
  var H = window.CopilotHarmony;
  var $ = function (id) { return document.getElementById(id); };

  var MOODS = H.MOODS;

  // Normalise theory.js quality strings to the words copilot-harmony expects.
  function qualityWord(q) {
    if (/dimin/.test(q)) return 'diminished';
    if (/augment/.test(q)) return 'augmented';
    if (/minor/.test(q)) return 'minor';
    return 'major';
  }

  // --- State ---------------------------------------------------------------
  var state = {
    moodId: null,             // null = custom "pick a key" path
    root: 'C',
    scale: 'major',
    slots: [null, null, null, null], // each = degree 1..7, or null
    bpm: 90,
    active: 0                 // slot the palette is editing (-1 = closed)
  };

  // Diatonic chords (triads) for the current key. Index 0..6; degree d = [d-1].
  var chords = [];
  function recomputeChords() {
    chords = T.diatonicChords(T.spellScale(state.root, state.scale), false);
  }
  function chordAt(deg) { return chords[deg - 1]; }
  function fnLabel(deg) { return H.functionLabel(deg, qualityWord(chordAt(deg).quality)); }

  // --- Analytics helpers (no-op until CRA-25 re-enabled) -------------------
  function ev(name, detail) { if (window.track) window.track(name, detail); }
  function evOnce(name, detail) {
    if (window.trackOncePerSession) window.trackOncePerSession(name, detail);
  }

  // --- Audio ---------------------------------------------------------------
  var audioCtx = null, master = null;
  function ensureAudio() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
      master = audioCtx.createGain();
      master.gain.value = 0.9;
      master.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  // One block triad: sawtooth voices through a gentle lowpass for warmth.
  function playChordAt(midi, time, dur) {
    if (!midi || !midi.length) return;
    var peak = 0.16 / Math.sqrt(midi.length);
    midi.forEach(function (m) {
      var osc = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      var lp = audioCtx.createBiquadFilter();
      osc.type = 'sawtooth';
      osc.frequency.value = T.midiToFreq(m);
      lp.type = 'lowpass';
      lp.frequency.value = 2200;
      osc.connect(g); g.connect(lp); lp.connect(master);
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(peak, time + 0.02);
      g.gain.exponentialRampToValueAtTime(peak * 0.55, time + dur * 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur * 0.97);
      osc.start(time);
      osc.stop(time + dur);
    });
  }

  // Preview a single chord immediately (on selection).
  function previewChord(deg) {
    var ctx = ensureAudio();
    if (!ctx || deg == null) return;
    playChordAt(chordAt(deg).midi, ctx.currentTime + 0.01, 0.9);
  }

  // --- Loop transport (lookahead scheduler) --------------------------------
  var playing = false, timer = null, nextTime = 0, step = 0, queue = [], rafId = 0;
  var SCHEDULE_AHEAD = 0.12, LOOKAHEAD_MS = 25;

  function chordSeconds() { return 2 * (60 / state.bpm); } // each chord = half note

  function scheduler() {
    while (nextTime < audioCtx.currentTime + SCHEDULE_AHEAD) {
      var deg = state.slots[step];
      if (deg != null) playChordAt(chordAt(deg).midi, nextTime, chordSeconds() * 0.98);
      queue.push({ step: step, time: nextTime });
      nextTime += chordSeconds();
      step = (step + 1) % 4;
    }
    timer = window.setTimeout(scheduler, LOOKAHEAD_MS);
  }

  function draw() {
    var cur = -1;
    while (queue.length && queue[0].time < audioCtx.currentTime) {
      cur = queue.shift().step;
    }
    if (cur !== -1) highlightPlaying(cur);
    rafId = window.requestAnimationFrame(draw);
  }

  function startPlay() {
    var ctx = ensureAudio();
    if (!ctx || playing) return;
    // Analytics: session marker + activation, and completion if all 4 filled.
    evOnce('chord_session');
    ev('play_pressed', state.moodId || 'custom');
    evOnce('play_pressed');
    if (state.slots.every(function (s) { return s != null; })) {
      ev('progression_completed', state.moodId || 'custom');
      evOnce('progression_completed');
    }
    playing = true;
    step = 0;
    queue = [];
    nextTime = ctx.currentTime + 0.06;
    scheduler();
    draw();
    syncTransport();
  }

  function stopPlay() {
    playing = false;
    if (timer) { clearTimeout(timer); timer = null; }
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    queue = [];
    highlightPlaying(-1);
    syncTransport();
  }

  function togglePlay() { playing ? stopPlay() : startPlay(); }

  // --- Rendering -----------------------------------------------------------
  function highlightPlaying(i) {
    var els = document.querySelectorAll('.cp-slot');
    for (var s = 0; s < els.length; s++) els[s].classList.toggle('playing', s === i);
  }

  function syncTransport() {
    var btn = $('cp-play');
    btn.textContent = playing ? '■ Stop' : '▶ Play';
    btn.classList.toggle('playing', playing);
  }

  function renderMoods() {
    var wrap = $('cp-moods');
    wrap.innerHTML = '';
    MOODS.forEach(function (m) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cp-mood' + (m.id === state.moodId ? ' active' : '');
      if (m.color) b.style.setProperty('--feel-color', m.color);
      b.innerHTML = '<span class="cp-mood__emoji" aria-hidden="true">' + m.emoji +
                    '</span><span class="cp-mood__label">' + m.name + '</span>';
      b.setAttribute('aria-pressed', m.id === state.moodId ? 'true' : 'false');
      b.title = m.blurb || '';
      b.addEventListener('click', function () { pickMood(m.id); });
      wrap.appendChild(b);
    });
  }

  function renderSlots() {
    var row = $('cp-slots');
    row.innerHTML = '';
    state.slots.forEach(function (deg, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cp-slot' + (deg != null ? ' filled' : '') + (i === state.active ? ' active' : '');
      if (deg == null) {
        b.innerHTML = '<span class="cp-slot__plus" aria-hidden="true">+</span>' +
                      '<span class="cp-slot__hint">Slot ' + (i + 1) + '</span>';
        b.setAttribute('aria-label', 'Slot ' + (i + 1) + ', empty. Tap to choose a chord.');
      } else {
        var c = chordAt(deg);
        b.innerHTML = '<span class="cp-slot__name">' + c.name + '</span>' +
                      '<span class="cp-slot__roman">' + c.roman + '</span>' +
                      '<span class="cp-slot__fn">' + fnLabel(deg) + '</span>';
        b.setAttribute('aria-label', 'Slot ' + (i + 1) + ': ' + c.name + ', ' + c.quality + '. Tap to change.');
      }
      b.addEventListener('click', function () { openSlot(i); });
      row.appendChild(b);
    });
  }

  // Palette: ranked suggestions first, then the rest of the in-key chords.
  function renderPalette() {
    var box = $('cp-palette');
    if (state.active < 0) { box.hidden = true; return; }
    box.hidden = false;

    var i = state.active;
    var prev = (i > 0 && state.slots[i - 1] != null) ? state.slots[i - 1] : 0;
    var ranked = H.suggestNext(prev, chords);     // 3 degrees, best first
    var inSug = {};
    ranked.forEach(function (d) { inSug[d] = true; });

    $('cp-palette-title').textContent = 'Slot ' + (i + 1) +
      (prev ? ' — good chords after ' + chordAt(prev).name : ' — strong openers');

    var sug = $('cp-suggested');
    sug.innerHTML = '';
    ranked.forEach(function (deg, rank) { sug.appendChild(chordButton(deg, rank + 1)); });

    var rest = $('cp-rest');
    rest.innerHTML = '';
    for (var deg = 1; deg <= 7; deg++) {
      if (!inSug[deg]) rest.appendChild(chordButton(deg, 0));
    }

    $('cp-clear').hidden = state.slots[i] == null;
  }

  function chordButton(deg, rank) {
    var c = chordAt(deg);
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'cp-chord' + (rank ? ' suggested' : '') +
                  (state.slots[state.active] === deg ? ' chosen' : '');
    var badge = rank ? '<span class="cp-chord__rank" aria-hidden="true">' +
                       (rank === 1 ? 'Top pick' : rank === 2 ? '2nd' : '3rd') + '</span>' : '';
    b.innerHTML = badge +
      '<span class="cp-chord__name">' + c.name + '</span>' +
      '<span class="cp-chord__fn">' + fnLabel(deg) + '</span>' +
      '<span class="cp-chord__roman">' + c.roman + '</span>';
    b.setAttribute('aria-label', c.name + ', ' + c.quality + ', function ' +
      fnLabel(deg) + (rank ? ', suggestion ' + rank : ''));
    b.addEventListener('click', function () { chooseChord(deg); });
    return b;
  }

  // --- Actions -------------------------------------------------------------
  function pickMood(id) {
    var m = H.MOOD_BY_ID[id];
    if (!m) return;
    state.moodId = id;
    state.root = m.root;
    state.scale = m.scale;
    if (m.bpm) { state.bpm = Math.max(60, Math.min(140, m.bpm)); }
    recomputeChords();
    state.slots = m.starters[0].slice(); // seed the first curated progression
    state.active = 0;
    if (playing) stopPlay();
    syncBpmControl();
    syncKeyControls();
    renderAll();
    updateUrl();
  }

  function openSlot(i) {
    state.active = i;
    renderSlots();
    renderPalette();
  }

  function chooseChord(deg) {
    var i = state.active;
    if (i < 0) return;
    state.slots[i] = deg;
    previewChord(deg);
    state.active = state.slots.indexOf(null); // advance to next empty (-1 if full)
    renderAll();
    updateUrl();
  }

  function clearSlot() {
    var i = state.active;
    if (i < 0) return;
    state.slots[i] = null;
    renderAll();
    updateUrl();
  }

  function surpriseMe() {
    var m = H.MOOD_BY_ID[state.moodId] || MOODS[0];
    if (!state.moodId) {
      state.moodId = m.id; state.root = m.root; state.scale = m.scale;
      if (m.bpm) state.bpm = Math.max(60, Math.min(140, m.bpm));
      recomputeChords();
    }
    // Cycle through the curated pool on repeated presses.
    var idx = Math.floor(((window.performance && performance.now()) || 0)) % m.starters.length;
    state.slots = m.starters[idx].slice();
    state.active = -1;
    ev('surprise_me_used', m.id);
    syncBpmControl();
    syncKeyControls();
    renderAll();
    updateUrl();
  }

  function setBpm(v) {
    state.bpm = Math.max(60, Math.min(140, v | 0));
    $('cp-bpm-val').textContent = state.bpm;
    updateCrossNav();
    updateUrl();
  }

  function setKey(root, scale) {
    state.root = root;
    state.scale = scale;
    state.moodId = null;
    recomputeChords();
    renderAll();
    updateUrl();
  }

  function renderAll() {
    renderMoods();
    renderSlots();
    renderPalette();
    updateCrossNav();
  }

  // --- Cross-nav + share ---------------------------------------------------
  function updateCrossNav() {
    var a = $('cp-jam');
    a.textContent = 'Jam at ' + state.bpm + ' BPM →';
    a.setAttribute('href', '../metronome/?bpm=' + state.bpm);
  }

  function shareUrl() {
    var p = new URLSearchParams();
    if (state.moodId) p.set('mood', state.moodId);
    p.set('key', state.root);
    p.set('scale', state.scale);
    p.set('prog', state.slots.map(function (s) { return s == null ? '_' : s; }).join('-'));
    p.set('bpm', state.bpm);
    return location.origin + location.pathname + '?' + p.toString();
  }

  function updateUrl() {
    var url = shareUrl();
    history.replaceState(null, '', url);
    var btn = $('cp-copy');           // share.js reads [data-copy-link] at click time
    if (btn) btn.setAttribute('data-copy-link', url);
  }

  // --- URL load ------------------------------------------------------------
  function readUrl() {
    var p = new URLSearchParams(location.search);
    var mood = p.get('mood');
    if (mood && H.MOOD_BY_ID[mood]) {
      var m = H.MOOD_BY_ID[mood];
      state.moodId = mood; state.root = m.root; state.scale = m.scale;
      if (m.bpm) state.bpm = Math.max(60, Math.min(140, m.bpm));
    }
    var key = p.get('key');
    if (key && T.ROOTS.indexOf(key) !== -1) state.root = key;
    var scale = p.get('scale');
    if (scale && T.SCALES[scale]) {
      state.scale = scale;
      if (mood && H.MOOD_BY_ID[mood] &&
          (H.MOOD_BY_ID[mood].root !== state.root || H.MOOD_BY_ID[mood].scale !== scale)) {
        state.moodId = null; // a custom key/scale overrides the mood
      }
    }
    var bpm = parseInt(p.get('bpm'), 10);
    if (bpm) state.bpm = Math.max(60, Math.min(140, bpm));
    var prog = p.get('prog');
    if (prog) {
      var parts = prog.split('-').slice(0, 4);
      var slots = [null, null, null, null];
      parts.forEach(function (tok, i) {
        var d = parseInt(tok, 10);
        if (tok !== '_' && d >= 1 && d <= 7) slots[i] = d;
      });
      state.slots = slots;
    }
  }

  // --- Init ----------------------------------------------------------------
  function syncKeyControls() {
    var rootSel = $('cp-key-root'), scaleSel = $('cp-key-scale');
    if (rootSel) rootSel.value = state.root;
    // The secondary picker only offers major/minor; leave it as-is for modal moods.
    if (scaleSel && (state.scale === 'major' || state.scale === 'minor')) scaleSel.value = state.scale;
  }
  function syncBpmControl() {
    var bpm = $('cp-bpm');
    if (bpm) bpm.value = state.bpm;
    $('cp-bpm-val').textContent = state.bpm;
  }

  function init() {
    var rootSel = $('cp-key-root');
    T.ROOTS.forEach(function (r) {
      var o = document.createElement('option');
      o.value = r;
      o.textContent = r.replace('#', '♯').replace('b', '♭');
      rootSel.appendChild(o);
    });

    readUrl();
    recomputeChords();
    if (state.slots.every(function (s) { return s == null; }) && !state.moodId) {
      state.active = 0; // fresh visit: open slot 1 so the palette invites a pick
    }
    syncKeyControls();
    syncBpmControl();

    rootSel.addEventListener('change', function (e) { setKey(e.target.value, state.scale); });
    $('cp-key-scale').addEventListener('change', function (e) { setKey(state.root, e.target.value); });
    $('cp-play').addEventListener('click', togglePlay);
    $('cp-surprise').addEventListener('click', surpriseMe);
    $('cp-clear').addEventListener('click', clearSlot);
    $('cp-bpm').addEventListener('input', function (e) { setBpm(parseInt(e.target.value, 10)); });
    $('cp-copy').addEventListener('click', function () { ev('share_copied', state.moodId || 'custom'); });
    $('cp-jam').addEventListener('click', function () { ev('cross_nav_click', String(state.bpm)); });

    renderAll();
    updateUrl();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }

  window.__copilot = { state: state, get chords() { return chords; } };
})();
