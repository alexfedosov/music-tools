/*
 * Chord & Scale Explorer — UI + Web Audio wiring.
 *
 * All music theory lives in theory.js (pure + tested). This file only renders
 * the spelled scale and its diatonic chords, keeps the URL shareable, and
 * plays notes/chords through a tiny Web Audio synth created lazily on the
 * first user gesture (browsers block audio until then).
 */
(function () {
  'use strict';
  var T = window.Theory;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    root: 'C',
    scale: 'major',
    sevenths: false
  };

  // --- Audio ---------------------------------------------------------------
  var audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  // Play one note with a soft, plucked envelope (triangle = warm but clear).
  function playFreq(freq, when, dur, gainScale) {
    var ctx = audioCtx;
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(ctx.destination);
    var peak = 0.22 * (gainScale || 1);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(peak, when + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  function playMidiChord(midiNotes) {
    var ctx = ensureAudio();
    if (!ctx) return;
    var t0 = ctx.currentTime;
    // Tiny upward stagger so chords feel strummed, not stabbed.
    midiNotes.forEach(function (m, i) {
      playFreq(T.midiToFreq(m), t0 + i * 0.022, 1.4, 1 / Math.sqrt(midiNotes.length));
    });
  }

  function playMidiNote(midi) {
    var ctx = ensureAudio();
    if (!ctx) return;
    playFreq(T.midiToFreq(midi), ctx.currentTime, 0.9, 0.9);
  }

  // --- Rendering -----------------------------------------------------------
  function render() {
    var notes = T.spellScale(state.root, state.scale);
    var scaleMeta = T.SCALES[state.scale];

    // Heading + formula.
    $('scale-title').textContent = notes[0].name + ' ' + scaleMeta.name;
    $('scale-formula').textContent = 'Steps: ' + T.stepPattern(state.scale);

    // Scale notes (click to hear). Each shows degree number above the name.
    var notesEl = $('scale-notes');
    notesEl.innerHTML = '';
    notes.forEach(function (n) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'note-pill';
      btn.innerHTML = '<span class="deg">' + n.degree + '</span>' +
                      '<span class="nm">' + n.name + '</span>';
      btn.setAttribute('aria-label', 'Play ' + n.name + ', scale degree ' + n.degree);
      btn.addEventListener('click', function () {
        playMidiNote(60 + n.interval);
        flash(btn);
      });
      notesEl.appendChild(btn);
    });

    // Diatonic chords (click to hear).
    var chords = T.diatonicChords(notes, state.sevenths);
    var grid = $('chord-grid');
    grid.innerHTML = '';
    chords.forEach(function (c) {
      var card = document.createElement('button');
      card.type = 'button';
      card.className = 'chord-card';
      card.innerHTML =
        '<span class="roman">' + c.roman + '</span>' +
        '<span class="chord-name">' + c.name + '</span>' +
        '<span class="chord-quality">' + c.quality + '</span>' +
        '<span class="chord-notes">' + c.notes.join(' · ') + '</span>';
      card.setAttribute('aria-label', 'Play ' + c.name + ' (' + c.quality + '): ' + c.notes.join(', '));
      card.addEventListener('click', function () {
        playMidiChord(c.midi);
        flash(card);
      });
      grid.appendChild(card);
    });

    updateUrl();
  }

  var flashTimers = new WeakMap();
  function flash(el) {
    el.classList.add('lit');
    clearTimeout(flashTimers.get(el));
    flashTimers.set(el, setTimeout(function () { el.classList.remove('lit'); }, 260));
  }

  // --- Shareable URL state -------------------------------------------------
  function updateUrl() {
    var p = new URLSearchParams();
    p.set('key', state.root);
    p.set('scale', state.scale);
    if (state.sevenths) p.set('chords', '7');
    history.replaceState(null, '', location.pathname + '?' + p.toString());
  }

  function readUrl() {
    var p = new URLSearchParams(location.search);
    var key = p.get('key');
    var scale = p.get('scale');
    if (key && T.ROOTS.indexOf(key) !== -1) state.root = key;
    if (scale && T.SCALES[scale]) state.scale = scale;
    if (p.get('chords') === '7') state.sevenths = true;
  }

  // --- Init ----------------------------------------------------------------
  function init() {
    // Populate root select.
    var rootSel = $('root-select');
    T.ROOTS.forEach(function (r) {
      var o = document.createElement('option');
      o.value = r;
      o.textContent = r.replace('#', '♯').replace('b', '♭');
      rootSel.appendChild(o);
    });
    // Populate scale select.
    var scaleSel = $('scale-select');
    T.SCALE_ORDER.forEach(function (key) {
      var o = document.createElement('option');
      o.value = key;
      o.textContent = T.SCALES[key].name;
      scaleSel.appendChild(o);
    });

    readUrl();
    rootSel.value = state.root;
    scaleSel.value = state.scale;
    $('seventh-toggle').checked = state.sevenths;

    rootSel.addEventListener('change', function (e) { state.root = e.target.value; render(); });
    scaleSel.addEventListener('change', function (e) { state.scale = e.target.value; render(); });
    $('seventh-toggle').addEventListener('change', function (e) {
      state.sevenths = e.target.checked; render();
    });

    render();
  }

  document.addEventListener('DOMContentLoaded', init);
  window.__explorer = { state: state, render: render };
})();
