/*
 * Music theory core — pure functions, no DOM, no audio.
 *
 * Everything here is deterministic and side-effect free so it can be unit
 * tested from Node (see scripts/theory.test.mjs). The interesting bit is
 * correct enharmonic spelling: a scale must use each letter name once, e.g.
 * Db major is Db-Eb-F-Gb-Ab-Bb-C, never Db-Eb-F-F#-... We get that by walking
 * letter names one per scale degree and computing the accidental needed to
 * land on the right pitch class.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; // Node
  root.Theory = api;                                                       // browser
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  // Pitch class (semitones above C) of each natural letter.
  var NATURAL_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

  // 7-note scales only — these are the scales for which "one letter per degree"
  // spelling and stacked-thirds diatonic chords are well defined.
  var SCALES = {
    major:         { name: 'Major (Ionian)',           intervals: [0, 2, 4, 5, 7, 9, 11] },
    dorian:        { name: 'Dorian',                    intervals: [0, 2, 3, 5, 7, 9, 10] },
    phrygian:      { name: 'Phrygian',                  intervals: [0, 1, 3, 5, 7, 8, 10] },
    lydian:        { name: 'Lydian',                    intervals: [0, 2, 4, 6, 7, 9, 11] },
    mixolydian:    { name: 'Mixolydian',                intervals: [0, 2, 4, 5, 7, 9, 10] },
    minor:         { name: 'Natural Minor (Aeolian)',   intervals: [0, 2, 3, 5, 7, 8, 10] },
    locrian:       { name: 'Locrian',                   intervals: [0, 1, 3, 5, 6, 8, 10] },
    harmonicMinor: { name: 'Harmonic Minor',            intervals: [0, 2, 3, 5, 7, 8, 11] },
    melodicMinor:  { name: 'Melodic Minor (ascending)', intervals: [0, 2, 3, 5, 7, 9, 11] }
  };

  var SCALE_ORDER = [
    'major', 'minor', 'dorian', 'phrygian', 'lydian',
    'mixolydian', 'locrian', 'harmonicMinor', 'melodicMinor'
  ];

  // Roots offered in the UI. Both common spellings are listed for black keys so
  // players can pick the one that fits the key they're thinking in.
  var ROOTS = ['C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F',
               'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'];

  var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];

  function mod(n, m) { return ((n % m) + m) % m; }

  // Parse a note name like "Bb", "F#", "C", "Ab" into {letter, pc}.
  function parseNote(name) {
    var letter = name[0].toUpperCase();
    var offset = 0;
    for (var i = 1; i < name.length; i++) {
      var c = name[i];
      if (c === '#' || c === '♯') offset += 1;
      else if (c === 'b' || c === '♭') offset -= 1;
    }
    return { letter: letter, pc: mod(NATURAL_PC[letter] + offset, 12) };
  }

  // Turn a signed accidental count into a display string using musical glyphs.
  function accidentalStr(n) {
    if (n === 0) return '';
    if (n === 1) return '♯';        // ♯
    if (n === -1) return '♭';       // ♭
    if (n === 2) return '×';        // × (double sharp)
    if (n === -2) return '♭♭'; // ♭♭
    return (n > 0 ? '+' : '') + n;       // unreachable for these scales
  }

  // Spell a scale: each degree gets the next letter name, then we compute the
  // accidental needed to reach the target pitch class. Returns one entry per
  // degree with its spelled name, pitch class, and semitone interval from root.
  function spellScale(rootName, scaleKey) {
    var scale = SCALES[scaleKey];
    if (!scale) throw new Error('Unknown scale: ' + scaleKey);
    var rootParsed = parseNote(rootName);
    var rootLetterIdx = LETTERS.indexOf(rootParsed.letter);

    return scale.intervals.map(function (interval, degree) {
      var letter = LETTERS[mod(rootLetterIdx + degree, 7)];
      var targetPc = mod(rootParsed.pc + interval, 12);
      // Smallest signed accidental that turns this letter into the target pc.
      var diff = mod(targetPc - NATURAL_PC[letter], 12);
      if (diff > 6) diff -= 12;
      return {
        name: letter + accidentalStr(diff),
        pc: targetPc,
        interval: interval,
        degree: degree + 1
      };
    });
  }

  // Whole/half step pattern of a scale, e.g. major -> "W W H W W W H".
  function stepPattern(scaleKey) {
    var iv = SCALES[scaleKey].intervals;
    var steps = [];
    for (var i = 0; i < iv.length; i++) {
      var next = (i + 1 < iv.length) ? iv[i + 1] : 12;
      var d = next - iv[i];
      steps.push(d === 1 ? 'H' : d === 2 ? 'W' : d === 3 ? 'W+H' : d);
    }
    return steps.join(' ');
  }

  // Classify a triad/seventh from semitone intervals above the chord root.
  // Returns the spoken quality, a chord-symbol suffix, and a roman-numeral
  // suffix. Built from the actual intervals so it stays correct for the exotic
  // chords in harmonic/melodic minor (augmented, minor-major 7, etc.).
  function classify(t3, t5, t7, withSeventh) {
    var triad;
    if (t3 === 4 && t5 === 7) triad = 'major';
    else if (t3 === 3 && t5 === 7) triad = 'minor';
    else if (t3 === 3 && t5 === 6) triad = 'diminished';
    else if (t3 === 4 && t5 === 8) triad = 'augmented';
    else triad = 'altered';

    if (!withSeventh) {
      var triadSuffix = { major: '', minor: 'm', diminished: 'dim',
                          augmented: 'aug', altered: '?' }[triad];
      var triadRoman = { major: '', minor: '', diminished: '°',
                         augmented: '+', altered: '?' }[triad];
      return { quality: triad, symbolSuffix: triadSuffix,
               romanSuffix: triadRoman, isLower: triad === 'minor' || triad === 'diminished' };
    }

    // Seventh: 11 = major 7th, 10 = minor 7th, 9 = diminished 7th.
    var sym, qual, romanSuffix;
    if (triad === 'major' && t7 === 11) { sym = 'maj7'; qual = 'major 7th'; romanSuffix = 'maj7'; }
    else if (triad === 'major' && t7 === 10) { sym = '7'; qual = 'dominant 7th'; romanSuffix = '7'; }
    else if (triad === 'minor' && t7 === 10) { sym = 'm7'; qual = 'minor 7th'; romanSuffix = '7'; }
    else if (triad === 'minor' && t7 === 11) { sym = 'm(maj7)'; qual = 'minor-major 7th'; romanSuffix = 'maj7'; }
    else if (triad === 'diminished' && t7 === 9) { sym = 'dim7'; qual = 'diminished 7th'; romanSuffix = '°7'; }
    else if (triad === 'diminished' && t7 === 10) { sym = 'm7♭5'; qual = 'half-diminished 7th'; romanSuffix = 'ø7'; }
    else if (triad === 'augmented' && t7 === 11) { sym = 'maj7♯5'; qual = 'augmented-major 7th'; romanSuffix = '+maj7'; }
    else if (triad === 'augmented' && t7 === 10) { sym = '7♯5'; qual = 'augmented 7th'; romanSuffix = '+7'; }
    else { sym = '7'; qual = triad + ' 7th'; romanSuffix = '7'; }

    return { quality: qual, symbolSuffix: sym, romanSuffix: romanSuffix,
             isLower: triad === 'minor' || triad === 'diminished' };
  }

  // Diatonic chords: stack thirds (degrees i, i+2, i+4 [, i+6]) on each scale
  // degree. Pitches/octaves are returned as semitone offsets from C4 (MIDI 60)
  // so the caller can sound them; chords ascend naturally up the scale.
  function diatonicChords(scaleNotes, withSeventh) {
    var n = scaleNotes.length; // 7
    return scaleNotes.map(function (rootNote, i) {
      var third = scaleNotes[mod(i + 2, n)];
      var fifth = scaleNotes[mod(i + 4, n)];
      var seventh = scaleNotes[mod(i + 6, n)];

      var t3 = mod(third.pc - rootNote.pc, 12);
      var t5 = mod(fifth.pc - rootNote.pc, 12);
      var t7 = mod(seventh.pc - rootNote.pc, 12);

      var c = classify(t3, t5, t7, withSeventh);

      var numeral = ROMAN[i];
      var roman = (c.isLower ? numeral.toLowerCase() : numeral) + c.romanSuffix;

      var tones = withSeventh ? [rootNote, third, fifth, seventh]
                              : [rootNote, third, fifth];
      // MIDI offsets from C4, stacked so the chord voices upward.
      var base = 60 + rootNote.interval;
      var midi = withSeventh ? [base, base + t3, base + t5, base + t7]
                             : [base, base + t3, base + t5];

      return {
        degree: i + 1,
        roman: roman,
        name: rootNote.name + c.symbolSuffix,
        quality: c.quality,
        notes: tones.map(function (t) { return t.name; }),
        midi: midi
      };
    });
  }

  // MIDI note number -> frequency (A4 = 440 Hz, MIDI 69).
  function midiToFreq(midi) { return 440 * Math.pow(2, (midi - 69) / 12); }

  return {
    LETTERS: LETTERS,
    SCALES: SCALES,
    SCALE_ORDER: SCALE_ORDER,
    ROOTS: ROOTS,
    parseNote: parseNote,
    accidentalStr: accidentalStr,
    spellScale: spellScale,
    stepPattern: stepPattern,
    classify: classify,
    diatonicChords: diatonicChords,
    midiToFreq: midiToFreq
  };
});
