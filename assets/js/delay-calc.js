/* Delay & Reverb time calculator — shared logic.
 *
 * Powers the /delay/ hub and every /delay/{bpm}-bpm/ chart page. The DOM it
 * expects is identical everywhere: #bpm, #rows, #table-caption, #metro-link,
 * #unit-ms, #unit-hz.
 *
 * Path-robust: the "open in metronome" link reads its base from
 * data-base on #metro-link (e.g. "../metronome/" on the hub,
 * "../../metronome/" on a per-BPM page) so the same file works at any depth.
 *
 * Precision: ms values are shown to 2 decimals (trailing zeros trimmed) so a
 * chart value like a quarter note at 128 BPM reads the true 468.75 ms, not a
 * rounded 468.8. Values >= 1000 ms round to whole numbers for readability.
 */
(function () {
  'use strict';
  // Note values: denominator d, where ms = (60000 / bpm) * (4 / d) * multiplier.
  // The beat (quarter) row is highlighted as the reference.
  var NOTES = [
    { name: 'Whole',         sub: '1/1', d: 1 },
    { name: 'Half',          sub: '1/2', d: 2 },
    { name: 'Quarter',       sub: '1/4 · beat', d: 4, beat: true },
    { name: 'Eighth',        sub: '1/8', d: 8 },
    { name: 'Sixteenth',     sub: '1/16', d: 16 },
    { name: 'Thirty-second', sub: '1/32', d: 32 }
  ];
  var MULT = [1, 1.5, 2 / 3];          // normal, dotted, triplet
  var bpmEl = document.getElementById('bpm');
  var rowsEl = document.getElementById('rows');
  var captionEl = document.getElementById('table-caption');
  var metroLink = document.getElementById('metro-link');
  var unitMsBtn = document.getElementById('unit-ms');
  var unitHzBtn = document.getElementById('unit-hz');
  if (!bpmEl || !rowsEl) return;       // not a delay page
  var metroBase = (metroLink && metroLink.getAttribute('data-base')) || '../metronome/';
  var unit = 'ms';

  function msFor(bpm, d, mult) { return (60000 / bpm) * (4 / d) * mult; }

  function fmt(ms) {
    if (!isFinite(ms) || ms <= 0) return { text: '—', u: '', copy: '' };
    if (unit === 'hz') {
      var hz = 1000 / ms;
      var h = hz >= 100 ? hz.toFixed(0) : hz.toFixed(2);
      return { text: h, u: ' Hz', copy: h };
    }
    // 2-decimal precision under 1000 ms (trailing zeros trimmed by String()),
    // whole numbers above for readability.
    var m = ms >= 1000 ? String(Math.round(ms)) : String(Math.round(ms * 100) / 100);
    return { text: m, u: ' ms', copy: m };
  }

  function render() {
    var bpm = parseFloat(bpmEl.value);
    var valid = isFinite(bpm) && bpm >= 20 && bpm <= 400;
    if (captionEl) {
      captionEl.textContent = valid
        ? 'Delay times at ' + (Number.isInteger(bpm) ? bpm : bpm.toFixed(1)) + ' BPM, in ' + (unit === 'hz' ? 'Hz' : 'milliseconds')
        : 'Enter a BPM between 20 and 400';
    }
    var html = '';
    NOTES.forEach(function (n) {
      html += '<tr class="' + (n.beat ? 'beat-row' : '') + '">';
      html += '<th scope="row">' + n.name + '<small>' + n.sub + '</small></th>';
      MULT.forEach(function (mult) {
        var f = valid ? fmt(msFor(bpm, n.d, mult)) : { text: '—', u: '', copy: '' };
        html += '<td><button class="val" type="button" data-copy="' + f.copy + '">'
              + f.text + '<span class="u">' + (f.u || '') + '</span></button></td>';
      });
      html += '</tr>';
    });
    rowsEl.innerHTML = html;
    if (valid && metroLink) metroLink.href = metroBase + '?bpm=' + Math.round(bpm);
  }

  function setUnit(u) {
    unit = u;
    if (unitMsBtn) unitMsBtn.setAttribute('aria-pressed', String(u === 'ms'));
    if (unitHzBtn) unitHzBtn.setAttribute('aria-pressed', String(u === 'hz'));
    render();
    if (window.track) window.track('delay_unit', u);
  }

  // Copy a value on click; flash the button.
  rowsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.val');
    if (!btn) return;
    var v = btn.getAttribute('data-copy');
    if (!v) return;
    var done = function () {
      btn.classList.add('copied');
      setTimeout(function () { btn.classList.remove('copied'); }, 900);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(v).then(done, done);
    } else { done(); }
    if (window.track) window.track('delay_copy');
  });

  bpmEl.addEventListener('input', render);
  if (unitMsBtn) unitMsBtn.addEventListener('click', function () { setUnit('ms'); });
  if (unitHzBtn) unitHzBtn.addEventListener('click', function () { setUnit('hz'); });

  // Accept a BPM handoff from Tap Tempo / Metronome via ?bpm=NNN — the same
  // URL contract the metronome already uses, so "tap → set delay time" flows.
  var seed = parseInt(new URLSearchParams(location.search).get('bpm'), 10);
  if (seed && seed >= 20 && seed <= 400) {
    bpmEl.value = seed;
    if (window.track) window.track('delay_bpm_handoff', String(seed));
  }
  render();
})();
