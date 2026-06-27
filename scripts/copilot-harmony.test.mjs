/*
 * Sanity tests for the Chord Co-pilot harmony brain. Run:
 *   node scripts/copilot-harmony.test.mjs
 * No framework — plain assertions, dependency-free like the rest of the site.
 *
 * These lock in the two promises the tool makes to a beginner:
 *   1) every chord we ever offer is in-key (diatonic), and
 *   2) we never *lead* a novice onto a diminished/augmented "trap" chord.
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const T = require('../assets/js/theory.js');
const H = require('../assets/js/copilot-harmony.js');

let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; } else { fail++; console.error(`FAIL ${label}`); }
}
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; } else { fail++; console.error(`FAIL ${label}\n  expected ${e}\n  got      ${a}`); }
}

const chordsFor = (m) => T.diatonicChords(T.spellScale(m.root, m.scale), false);

// --- Every mood resolves to a real, well-formed key -------------------------
ok(H.MOODS.length === 5, 'five moods');
for (const m of H.MOODS) {
  ok(!!T.SCALES[m.scale], `${m.id}: scale ${m.scale} exists`);
  ok(T.ROOTS.indexOf(m.root) !== -1, `${m.id}: root ${m.root} valid`);
  const chords = chordsFor(m);
  eq(chords.length, 7, `${m.id}: 7 diatonic chords`);

  // Starter progressions only reference degrees 1..7, are 4 chords long, and
  // never contain a diminished/augmented chord (these are the "polished"
  // defaults — they must always sound good).
  for (const prog of m.starters) {
    eq(prog.length, 4, `${m.id}: starter has 4 chords`);
    for (const d of prog) {
      ok(d >= 1 && d <= 7, `${m.id}: degree ${d} in range`);
      const q = chords[d - 1].quality;
      ok(q !== 'diminished' && q !== 'augmented',
        `${m.id}: starter chord deg ${d} (${chords[d - 1].name}) is consonant, got ${q}`);
    }
  }
}

// --- Function labels are always one of the four words -----------------------
const LABELS = new Set([H.FN.HOME, H.FN.LIFT, H.FN.TENSION, H.FN.EMOTION]);
for (const m of H.MOODS) {
  const chords = chordsFor(m);
  chords.forEach((c, i) => {
    const lab = H.functionLabel(i + 1, qualityWord(c.quality));
    ok(LABELS.has(lab), `${m.id}: deg ${i + 1} label "${lab}" is one of the four`);
  });
  // Tonic is always Home.
  eq(H.functionLabel(1, qualityWord(chords[0].quality)), H.FN.HOME, `${m.id}: tonic = Home`);
}

// Theory.classify returns 'major'/'minor'/'diminished'/'augmented' for triads
// directly in `quality` for triads; normalise just in case of 7th wording.
function qualityWord(q) {
  if (/dimin/.test(q)) return 'diminished';
  if (/augment/.test(q)) return 'augmented';
  if (/minor/.test(q)) return 'minor';
  return 'major';
}

// --- suggestNext: always 3 in-range, distinct, never repeats prev -----------
for (const m of H.MOODS) {
  const chords = chordsFor(m);
  for (let prev = 0; prev <= 7; prev++) {
    const sug = H.suggestNext(prev, chords);
    eq(sug.length, 3, `${m.id}: 3 suggestions after ${prev}`);
    ok(new Set(sug).size === 3, `${m.id}: suggestions distinct after ${prev}`);
    ok(sug.indexOf(prev) === -1 || prev === 0, `${m.id}: never re-suggests prev ${prev}`);
    for (const d of sug) ok(d >= 1 && d <= 7, `${m.id}: suggestion ${d} in range`);
  }
  // Opening slot always leads with the tonic (start Home).
  eq(H.suggestNext(0, chords)[0], 1, `${m.id}: first suggestion is the tonic`);
}

// --- The trap test: a diminished/augmented chord must NEVER be the #1 pick ---
let trapLeads = 0;
for (const m of H.MOODS) {
  const chords = chordsFor(m);
  for (let prev = 0; prev <= 7; prev++) {
    const top = H.suggestNext(prev, chords)[0];
    const q = qualityWord(chords[top - 1].quality);
    if (q === 'diminished' || q === 'augmented') {
      trapLeads++;
      console.error(`  trap: ${m.id} after ${prev} leads with ${chords[top - 1].name} (${q})`);
    }
  }
}
eq(trapLeads, 0, 'no diminished/augmented chord is ever the top suggestion');

// --- A couple of musical spot-checks (C major) ------------------------------
const cmaj = T.diatonicChords(T.spellScale('C', 'major'), false);
// After V (G, degree 5) the strongest move should resolve Home (I).
eq(H.suggestNext(5, cmaj)[0], 1, 'C major: V resolves to I');
// After ii (Dm, degree 2) the dominant V should be among suggestions.
ok(H.suggestNext(2, cmaj).indexOf(5) !== -1, 'C major: ii suggests V');

console.log(`\ncopilot-harmony: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
