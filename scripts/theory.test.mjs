/*
 * Sanity tests for the music theory core. Run: node scripts/theory.test.mjs
 * No framework — just assertions, so it stays dependency-free like the site.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const T = require('../assets/js/theory.js');

let pass = 0, fail = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; }
  else { fail++; console.error(`FAIL ${label}\n  expected ${e}\n  got      ${a}`); }
}

const names = (root, scale) => T.spellScale(root, scale).map(n => n.name);

// --- Scale spelling: each must use distinct letter names, correctly. --------
eq(names('C', 'major'), ['C', 'D', 'E', 'F', 'G', 'A', 'B'], 'C major');
eq(names('G', 'major'), ['G', 'A', 'B', 'C', 'D', 'E', 'F♯'], 'G major');
eq(names('F', 'major'), ['F', 'G', 'A', 'B♭', 'C', 'D', 'E'], 'F major');
eq(names('Db', 'major'), ['D♭', 'E♭', 'F', 'G♭', 'A♭', 'B♭', 'C'], 'Db major');
eq(names('B', 'major'), ['B', 'C♯', 'D♯', 'E', 'F♯', 'G♯', 'A♯'], 'B major');
eq(names('A', 'minor'), ['A', 'B', 'C', 'D', 'E', 'F', 'G'], 'A natural minor');
eq(names('E', 'minor'), ['E', 'F♯', 'G', 'A', 'B', 'C', 'D'], 'E natural minor');
eq(names('D', 'dorian'), ['D', 'E', 'F', 'G', 'A', 'B', 'C'], 'D dorian');
eq(names('C', 'lydian'), ['C', 'D', 'E', 'F♯', 'G', 'A', 'B'], 'C lydian');
eq(names('G', 'mixolydian'), ['G', 'A', 'B', 'C', 'D', 'E', 'F'], 'G mixolydian');
eq(names('A', 'harmonicMinor'), ['A', 'B', 'C', 'D', 'E', 'F', 'G♯'], 'A harmonic minor');
eq(names('A', 'melodicMinor'), ['A', 'B', 'C', 'D', 'E', 'F♯', 'G♯'], 'A melodic minor');

// Distinct-letter invariant across every root + scale (the spelling guarantee).
let letterViolations = 0;
for (const r of T.ROOTS) for (const s of T.SCALE_ORDER) {
  const letters = T.spellScale(r, s).map(n => n.name[0]);
  if (new Set(letters).size !== 7) { letterViolations++; console.error(`  letters not distinct: ${r} ${s} -> ${letters}`); }
}
eq(letterViolations, 0, 'all scales use 7 distinct letters');

// --- Diatonic triads ---------------------------------------------------------
const triadSyms = (root, scale) =>
  T.diatonicChords(T.spellScale(root, scale), false).map(c => c.name);
const romans = (root, scale, sev) =>
  T.diatonicChords(T.spellScale(root, scale), sev).map(c => c.roman);

eq(triadSyms('C', 'major'), ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Bdim'], 'C major triads');
eq(romans('C', 'major', false), ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'], 'C major roman triads');
eq(triadSyms('A', 'minor'), ['Am', 'Bdim', 'C', 'Dm', 'Em', 'F', 'G'], 'A minor triads');
// Harmonic minor: the III is augmented and V is major (the whole point of it).
eq(triadSyms('A', 'harmonicMinor'), ['Am', 'Bdim', 'Caug', 'Dm', 'E', 'F', 'G♯dim'], 'A harmonic minor triads');
eq(romans('A', 'harmonicMinor', false), ['i', 'ii°', 'III+', 'iv', 'V', 'VI', 'vii°'], 'A harmonic minor romans');

// --- Diatonic sevenths -------------------------------------------------------
const sevenSyms = (root, scale) =>
  T.diatonicChords(T.spellScale(root, scale), true).map(c => c.name);
eq(sevenSyms('C', 'major'),
   ['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5'], 'C major sevenths');
// Harmonic minor sevenths exercise minor-major7, dim7, half-dim, aug-maj7.
eq(sevenSyms('A', 'harmonicMinor'),
   ['Am(maj7)', 'Bm7♭5', 'Cmaj7♯5', 'Dm7', 'E7', 'Fmaj7', 'G♯dim7'], 'A harmonic minor sevenths');

// --- Pitch / frequency -------------------------------------------------------
eq(Math.round(T.midiToFreq(69)), 440, 'A4 = 440Hz');
eq(Math.round(T.midiToFreq(60)), 262, 'C4 ~ 262Hz');
// First diatonic chord of C major should sound C-E-G from C4 (60,64,67).
eq(T.diatonicChords(T.spellScale('C', 'major'), false)[0].midi, [60, 64, 67], 'C major I chord midi');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
