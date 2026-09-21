/* ERA Sanitary — interactions. No dependencies.
   The language switch is plain links between /… and /bn/…, so it works with
   JavaScript off and both languages stay crawlable and shareable. */
(function () {
  'use strict';

  /* ---------- Mobile nav ---------- */
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('primaryNav');
  var header = document.getElementById('siteHeader');

  function setOffset() {
    if (!header) return;
    document.documentElement.style.setProperty(
      '--header-bottom', Math.round(header.getBoundingClientRect().bottom) + 'px');
  }

  if (toggle && nav) {
    setOffset();
    window.addEventListener('resize', setOffset);
    window.addEventListener('scroll', setOffset, { passive: true });

    toggle.addEventListener('click', function () {
      var open = toggle.getAttribute('aria-expanded') !== 'true';
      setOffset();
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || toggle.getAttribute('aria-expanded') !== 'true') return;
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    });
  }

  /* ---------- Footer year ---------- */
  var year = document.querySelector('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ---------- Quote form -> pre-filled WhatsApp message ---------- */
  var form = document.getElementById('quoteForm');
  if (!form) return;

  var strings = {};
  try {
    strings = JSON.parse(document.getElementById('quoteStrings').textContent);
  } catch (e) {
    return; // Without the strings the message would be malformed; leave the form inert.
  }

  var errorBox = null;

  function showError(msg) {
    if (!errorBox) {
      errorBox = document.createElement('p');
      errorBox.className = 'form-error';
      errorBox.setAttribute('role', 'alert');
      form.insertBefore(errorBox, form.firstChild);
    }
    errorBox.textContent = msg;
  }

  function clearError() {
    if (errorBox) { errorBox.remove(); errorBox = null; }
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var name = form.elements.name.value.trim();
    var phone = form.elements.phone.value.trim();
    var category = form.elements.category.value;
    var items = form.elements.items.value.trim();

    // A quote needs something to quote, and a way to reply if WhatsApp drops.
    if (!items && !phone) {
      showError(strings.err);
      (items ? form.elements.phone : form.elements.items).focus();
      return;
    }
    clearError();

    var lines = [strings.hello];
    if (name) lines.push(strings.name + ': ' + name);
    if (phone) lines.push(strings.phone + ': ' + phone);
    lines.push(strings.cat + ': ' + category);
    if (items) lines.push(strings.items + ': ' + items);
    lines.push(strings.close);

    var url = 'https://wa.me/' + form.getAttribute('data-wa') +
      '?text=' + encodeURIComponent(lines.join('\n'));

    var win = window.open(url, '_blank', 'noopener');
    if (!win) window.location.href = url; // popup blocked — navigate instead
  });
})();
