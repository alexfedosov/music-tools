/*
 * THE FEEL LIBRARY — Pocket Tempo's signature wedge.
 *
 * Every other free metronome gives you an abstract "swing %" slider. We give
 * you *named, real-record human feels*: the J Dilla lurch, the Purdie shuffle,
 * boom-bap, behind-the-beat. This file is the single source of truth for that
 * library — it powers the playable selector on the metronome, the per-feel SEO
 * landing pages, and the social share cards. Keep it data-only.
 *
 * THE TIMING MODEL (why this is accurate, not a gimmick):
 * A "feel" is a micro-timing pattern over ONE beat (one quarter note). Each
 * step is { t, g } where:
 *   - t = position WITHIN the beat as a fraction 0..1 (0 = on the beat,
 *         0.5 = the straight "&", 0.667 = the swung/triplet "&").
 *   - g = relative gain 0..1 (lets us ghost the in-between notes like a real
 *         drummer does).
 * `drag` shifts the whole feel voice late (+) or early (−) as a fraction of the
 * beat — that's how "behind the beat" and "on top" become real, measurable
 * micro-timing instead of a vibe. When `pulse` is true the metronome also ticks
 * a steady straight quarter underneath, so you can HEAR the feel leaning
 * against the grid (essential for the drag/push feels).
 *
 * The numbers are deliberately musical, not arbitrary: a hard swing lands its
 * "&" on the triplet (0.667); behind-the-beat drags ~30–40 ms at its default
 * tempo, the pocket soul players actually sit in.
 *
 * ES module: imported directly by the browser metronome AND by the Node build
 * scripts (landing pages, OG cards) so the library can never drift out of sync.
 */

export const FEELS = [
  {
    id: 'straight',
    name: 'Straight',
    tagline: 'The grid. Dead-center, no lean.',
    emoji: '▦',
    color: '#9aa3b2',
    defaultBpm: 120,
    sub: 'quarter notes',
    pulse: false,
    drag: 0,
    steps: [{ t: 0, g: 1 }],
    heardOn: ['Most click tracks', 'Quantized electronic music', 'Drum-machine demos'],
    about:
      'A perfectly even pulse — every beat dead on the grid. This is the reference every other feel leans against. Great for tightening up your timing, learning a part, or tracking to a click.',
    howto:
      'Start here to find the tempo, then switch to a named feel to hear the same BPM come alive with a human lean.',
    keywords: 'online metronome, straight time, click track, practice metronome',
  },
  {
    id: 'swing',
    name: 'Swing',
    tagline: 'The triplet shuffle. Jazz, blues, shuffle grooves.',
    emoji: '🎷',
    color: '#f2b134',
    defaultBpm: 120,
    sub: 'swung 8ths',
    pulse: false,
    drag: 0,
    // The off-beat "&" lands on the triplet (2/3 of the beat) — true hard swing.
    steps: [{ t: 0, g: 1 }, { t: 0.667, g: 0.6 }],
    heardOn: ['Jazz ride patterns', 'Blues shuffles', 'Swung house & garage'],
    about:
      'Classic triplet swing: the off-beat "and" slides back to land on the triplet instead of dead-center. It’s the bounce in a ride cymbal, a shuffle blues, a swung hi-hat. Turn it on and a stiff line instantly starts to lope.',
    howto:
      'Practice your 8th-note lines against it so your off-beats lock to the triplet, not the straight grid. Try it at 100–140 BPM for a jazz ride, slower for a blues shuffle.',
    keywords: 'swing metronome, shuffle metronome, triplet swing, jazz metronome, swung 8ths',
  },
  {
    id: 'dilla',
    name: 'Dilla',
    tagline: 'The drunk, lopsided lurch. J Dilla’s broken grid.',
    emoji: '🌀',
    color: '#b48cff',
    defaultBpm: 86,
    sub: 'lopsided 16ths',
    pulse: true,
    drag: 0.02,
    // Uneven 16ths: the "e" sits late, the "a" rushes early — the wonky lurch
    // Dilla got by not quantizing. Whole pattern drags slightly behind.
    steps: [
      { t: 0, g: 1 },
      { t: 0.29, g: 0.42 },
      { t: 0.5, g: 0.6 },
      { t: 0.71, g: 0.42 },
    ],
    heardOn: ['J Dilla — Donuts', 'Slum Village — Fantastic', 'Erykah Badu — Mama’s Gun'],
    about:
      'J Dilla famously turned OFF the quantize. His 16ths sit unevenly — some rushed, some dragged — so the groove lurches and breathes like a human who refuses to be a machine. A whole book (Dan Charnas’ NYT-bestselling Dilla Time) exists about this one feel. The steady pulse ticks underneath so you can hear the lurch pull against the grid.',
    howto:
      'Don’t fight it — lean into the wobble. Program your hats and snares to the lopsided clicks and your beat stops sounding like a robot. Best around 80–95 BPM.',
    keywords: 'dilla feel, j dilla groove, dilla time, drunk drums, unquantized hip hop, lo-fi metronome',
  },
  {
    id: 'purdie',
    name: 'Purdie Shuffle',
    tagline: 'The half-time shuffle with ghost notes.',
    emoji: '🥁',
    color: '#4dd6c1',
    defaultBpm: 96,
    sub: 'triplet shuffle',
    pulse: false,
    drag: 0,
    // Triplet feel with a ghosted middle triplet — Bernard Purdie's signature
    // half-time shuffle (Steely Dan, Toto "Rosanna" lineage).
    steps: [
      { t: 0, g: 1 },
      { t: 0.333, g: 0.2 },
      { t: 0.667, g: 0.55 },
    ],
    heardOn: ['Steely Dan — Home at Last', 'Toto — Rosanna', 'Bernard Purdie sessions'],
    about:
      'Bernard "Pretty" Purdie’s half-time shuffle is one of the most-copied grooves in recorded music. The magic is the ghost notes: quiet triplet taps tucked between the backbeats that give the shuffle its silky, rolling feel. We voice those ghosts at low volume so you hear the full triplet skeleton.',
    howto:
      'Lay your backbeat on the loud clicks and let the quiet ghost-triplets guide your in-between strokes. Sits beautifully around 90–100 BPM.',
    keywords: 'purdie shuffle, half time shuffle metronome, ghost notes, rosanna shuffle, drum shuffle',
  },
  {
    id: 'boom-bap',
    name: 'Boom Bap',
    tagline: 'Laid-back 90s hip-hop. Dusty, behind, swung.',
    emoji: '📻',
    color: '#ff8a5c',
    defaultBpm: 90,
    sub: 'swung 16ths',
    pulse: true,
    drag: 0.015,
    // Gentle 16th swing + a touch behind — the SP-1200/MPC pocket of 90s NY.
    steps: [
      { t: 0, g: 1 },
      { t: 0.27, g: 0.4 },
      { t: 0.5, g: 0.62 },
      { t: 0.77, g: 0.4 },
    ],
    heardOn: ['DJ Premier productions', 'Pete Rock — Mecca & the Soul Brother', 'A Tribe Called Quest'],
    about:
      'The boom-bap pocket: hard kick and snare with lightly swung 16ths that sit a hair behind the beat, the way an SP-1200 or MPC60 nudges things when you don’t quantize hard. Dusty, head-nodding, unmistakably 90s.',
    howto:
      'Chop your samples and place your snare on the laid-back clicks for that boom-bap head-nod. Lives at 85–95 BPM.',
    keywords: 'boom bap metronome, 90s hip hop groove, mpc swing, sp1200 feel, lo-fi hip hop tempo',
  },
  {
    id: 'behind',
    name: 'Behind the Beat',
    tagline: 'The laid-back pocket. Drag it ~35 ms late.',
    emoji: '🛋️',
    color: '#6ea8ff',
    defaultBpm: 92,
    sub: 'dragged quarters',
    pulse: true,
    drag: 0.06,
    // The feel voice lands consistently late against the steady pulse — the
    // D'Angelo / soul "in the cracks" lean.
    steps: [{ t: 0, g: 1 }],
    heardOn: ['D’Angelo — Voodoo', 'Soul & neo-soul ballads', 'Questlove pocket grooves'],
    about:
      'Some of the deepest grooves ever recorded sit just behind the beat — D’Angelo’s Voodoo is the textbook case. The feel click lands consistently late against the steady reference pulse so you can train your hands to drag in the same relaxed, fat pocket without falling apart.',
    howto:
      'Keep the steady pulse as your true time, then play your part to the late click. Feel how dragging ~30–40 ms makes everything sound heavier and more relaxed.',
    keywords: 'behind the beat metronome, laid back pocket, dangelo groove, lazy feel, neo soul timing',
  },
  {
    id: 'push',
    name: 'On Top',
    tagline: 'Pushing ahead. Urgent, driving, on the front edge.',
    emoji: '⚡',
    color: '#ff5d5d',
    defaultBpm: 150,
    sub: 'pushed quarters',
    pulse: true,
    drag: -0.04,
    // The feel voice lands slightly ahead of the steady pulse — the energetic
    // "leaning forward" feel of punk, fast rock, driving dance music.
    steps: [{ t: 0, g: 1 }],
    heardOn: ['Punk & fast rock', 'Driving four-on-the-floor', 'Energetic live performances'],
    about:
      'The opposite of laid-back: playing "on top" of the beat, a hair ahead of dead-center, gives music urgency and drive. The feel click lands just in front of the steady pulse so you can practice leaning forward without actually speeding up.',
    howto:
      'Hold the steady pulse as your anchor and play to the slightly-early click. Great for tightening up fast punk, rock, or dance parts that need to push.',
    keywords: 'ahead of the beat, pushing the beat metronome, on top of the beat, driving feel, punk timing',
  },
];

export const FEEL_BY_ID = FEELS.reduce(function (m, f) { m[f.id] = f; return m; }, {});

// The named feels (everything except the plain "straight" reference) — what we
// build landing pages and share cards for.
export const NAMED_FEELS = FEELS.filter(function (f) { return f.id !== 'straight'; });
