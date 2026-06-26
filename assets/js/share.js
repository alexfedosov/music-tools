/*
 * Share + tip-jar wiring. Shared across every page. No dependencies.
 *
 *  - [data-copy-link]  buttons copy the page's canonical URL (or the current
 *    URL) to the clipboard and flash "Copied!". Falls back to a hidden
 *    <textarea> + execCommand on browsers without the async Clipboard API.
 *  - [data-tip-jar]    elements (links/buttons) are revealed only when
 *    window.SITE.tipJarUrl is set, and have their href pointed at it. This
 *    keeps a broken tip link from ever shipping.
 */
(function () {
  'use strict';

  function canonicalUrl() {
    var link = document.querySelector('link[rel="canonical"]');
    return (link && link.href) || location.href;
  }

  function flash(btn, msg) {
    var original = btn.getAttribute('data-label') || btn.textContent;
    if (!btn.getAttribute('data-label')) btn.setAttribute('data-label', original);
    btn.textContent = msg;
    btn.classList.add('copied');
    window.setTimeout(function () {
      btn.textContent = btn.getAttribute('data-label');
      btn.classList.remove('copied');
    }, 1600);
  }

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (e) { reject(e); }
    });
  }

  function wireCopyButtons() {
    var btns = document.querySelectorAll('[data-copy-link]');
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          copy(btn.getAttribute('data-copy-link') || canonicalUrl())
            .then(function () { flash(btn, 'Copied!'); })
            .catch(function () { flash(btn, 'Press Ctrl+C'); });
        });
      })(btns[i]);
    }
  }

  function wireTipJar() {
    var url = (window.SITE && window.SITE.tipJarUrl) || '';
    var els = document.querySelectorAll('[data-tip-jar]');
    for (var i = 0; i < els.length; i++) {
      if (url) {
        els[i].setAttribute('href', url);
        els[i].hidden = false;
      } else {
        els[i].hidden = true;
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { wireCopyButtons(); wireTipJar(); });
  } else {
    wireCopyButtons();
    wireTipJar();
  }
})();
