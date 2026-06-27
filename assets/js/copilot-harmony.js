/*
 * Chord Co-pilot — harmony expertise, encoded as pure data + functions.
 *
 * This is the "co-pilot" brain: it knows which key fits a mood and which chord
 * tends to sound good after another, so a novice with zero theory writes a
 * progression they're proud of. It has NO DOM and NO audio — everything here is
 * deterministic and side-effect free, so it's unit-tested from Node (see
 * scripts/copilot-harmony.test.mjs).
 *
 * It deliberately leans on theory.js for the hard part (correct diatonic chords
 * with proper enharmonic spelling + MIDI). The caller passes in the 7-element
 * `chords` array from Theory.diatonicChords(); we only RANK and LABEL it. That
 * keeps every suggestion guaranteed in-key, and keeps the mode-correctness we
 * already tested in theory.js.
 *
 * MODE-SAFETY (why labels/ranking read chord quality, not just scale degree):
 * In Lydian the IV is diminished; in Dorian the vi is diminished. A degree
 * table written for plain major would mislabel those and could steer a beginner
 * onto a dissonant chord. So function labels come from the chord's actual
 * quality, and the ranker buries diminished/augmented chords — the novice is
 * never offered a trap.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; // Node
  root.CopilotHarmony = api;                                              // browser
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // The four one-word function labels shown on every suggestion. They translate
  // harmonic function into plain feeling words a non-musician understands.
  var FN = { HOME: 'Home', LIFT: 'Lift', TENSION: 'Tension', EMOTION: 'Emotional' };

  // Five moods. Each picks a key (root + scale) that carries the feeling, a set
  // of expert "starter" progressions (degrees 1..7, four chords each, hand-
  // picked to sound good and to avoid any diminished chord), and a default
  // tempo. The first starter is the one we drop in on mood-select; the rest feed
  // "Surprise me".
  var MOODS = [
    {
      id: 'happy', name: 'Happy', emoji: '😄', color: '#ffd23f',
      root: 'C', scale: 'major', bpm: 120,
      blurb: 'Bright and major — the sound of a pop chorus.',
      starters: [
        [1, 5, 6, 4],   // I–V–vi–IV   the four-chord anthem
        [1, 4, 5, 4],   // I–IV–V–IV
        [1, 6, 4, 5],   // I–vi–IV–V   50s doo-wop
        [1, 6, 2, 5]    // I–vi–ii–V   turnaround
      ]
    },
    {
      id: 'sad', name: 'Sad', emoji: '😢', color: '#5b8def',
      root: 'A', scale: 'minor', bpm: 72,
      blurb: 'Minor key, gentle pull — wistful and tender.',
      starters: [
        [1, 6, 3, 7],   // i–VI–III–VII
        [1, 4, 1, 5],   // i–iv–i–v
        [1, 7, 6, 5],   // i–VII–VI–v
        [1, 4, 6, 5]    // i–iv–VI–v
      ]
    },
    {
      id: 'dreamy', name: 'Dreamy', emoji: '🌙', color: '#b07cf7',
      root: 'C', scale: 'lydian', bpm: 84,
      blurb: 'Floating and cinematic — the raised-4th Lydian shimmer.',
      starters: [
        [1, 2, 1, 2],   // I–II vamp (the Lydian signature)
        [1, 2, 6, 5],   // I–II–vi–V
        [6, 2, 1, 5],   // vi–II–I–V
        [1, 5, 2, 6]    // I–V–II–vi
      ]
    },
    {
      id: 'epic', name: 'Epic', emoji: '⚡', color: '#ff7847',
      root: 'E', scale: 'minor', bpm: 92,
      blurb: 'Anthemic minor with soaring major lifts — trailer energy.',
      starters: [
        [1, 6, 7, 1],   // i–VI–VII–i   the cinematic climb
        [1, 6, 7, 3],   // i–VI–VII–III
        [6, 7, 1, 1],   // VI–VII–i
        [1, 7, 6, 7]    // i–VII–VI–VII
      ]
    },
    {
      id: 'lofi', name: 'Lo-fi', emoji: '🎧', color: '#4dd6c1',
      root: 'D', scale: 'dorian', bpm: 76,
      blurb: 'Dorian jazz-chill — the lo-fi hip-hop sweet spot.',
      starters: [
        [1, 4, 1, 4],   // i–IV vamp (Dorian's bright IV)
        [1, 4, 7, 3],   // i–IV–VII–III
        [1, 5, 7, 4],   // i–v–VII–IV
        [1, 7, 4, 1]    // i–VII–IV–i
      ]
    }
  ];

  var MOOD_BY_ID = {};
  MOODS.forEach(function (m) { MOOD_BY_ID[m.id] = m; });

  // Function label for a diatonic chord, from its scale degree (1-based) and the
  // chord's quality string as produced by Theory.classify ('major','minor',
  // 'diminished','augmented'). Tonic is always Home; the dominant (degree 5) and
  // any unstable chord is Tension; other major chords lift, minor chords pull on
  // the heart.
  function functionLabel(degree, quality) {
    if (degree === 1) return FN.HOME;
    if (quality === 'diminished' || quality === 'augmented') return FN.TENSION;
    if (degree === 5) return FN.TENSION;
    if (quality === 'major') return FN.LIFT;
    return FN.EMOTION; // minor (ii, iii, vi, iv, ...)
  }

  // Score how good chord `q` (degree 1..7) sounds *after* chord `prev` (degree
  // 1..7, or 0 when the slot opens a progression). Encodes a few rules of thumb
  // from pop/songwriting harmony: songs love landing Home or on the dominant,
  // root motion down a fifth is the strongest pull, the vi/IV give a deceptive
  // or uplifting turn, and step motion is smooth. Diminished/augmented chords
  // are pushed down so a beginner is never *led* into one.
  function scoreNext(prev, q, chords) {
    if (q === prev) return -Infinity;          // don't suggest staying put
    var quality = chords[q - 1].quality;
    var s = 0;
    if (q === 1) s += 4;     // resolve Home
    if (q === 5) s += 4;     // to the dominant
    if (q === 6) s += 2;     // deceptive / emotional
    if (q === 4) s += 2;     // subdominant lift
    if (q === 2) s += 1.5;   // pre-dominant
    if (prev) {
      // Root motion down a perfect fifth ≈ three scale steps up the cycle.
      var downFifth = ((prev - 1 + 3) % 7) + 1;
      if (q === downFifth) s += 3;
      // Stepwise motion (either direction, with octave wrap) is smooth.
      var step = Math.min((q - prev + 7) % 7, (prev - q + 7) % 7);
      if (step === 1) s += 1;
    }
    if (quality === 'diminished') s -= 5;       // bury — never a beginner default
    else if (quality === 'augmented') s -= 3;
    else if (quality === 'major') s += 0.5;
    return s;
  }

  // The 3 best "next chord" suggestions after `prev` (0 = first slot). Returns an
  // array of degrees (1..7), best first. For an opening slot we always lead with
  // the tonic (start Home) and then the next two strongest options.
  function suggestNext(prev, chords) {
    var cands = [];
    for (var q = 1; q <= 7; q++) {
      if (q === prev) continue;
      var sc = scoreNext(prev || 0, q, chords);
      if (!prev && q === 1) sc += 10; // openers start Home
      cands.push({ q: q, s: sc });
    }
    cands.sort(function (a, b) { return b.s - a.s || a.q - b.q; });
    return cands.slice(0, 3).map(function (c) { return c.q; });
  }

  return {
    FN: FN,
    MOODS: MOODS,
    MOOD_BY_ID: MOOD_BY_ID,
    functionLabel: functionLabel,
    scoreNext: scoreNext,
    suggestNext: suggestNext
  };
});
