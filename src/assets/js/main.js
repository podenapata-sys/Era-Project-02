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

  /* ---------- Open-now badge ----------
     The shop keeps Dhaka hours (UTC+6) whatever the visitor's clock says, so the
     current Dhaka time is derived from UTC rather than from the local Date. The
     element ships hidden and empty; if this code never runs the visitor sees no
     badge at all, which is better than a confident wrong one. */
  var badge = document.getElementById('openBadge');
  if (badge) {
    var DHAKA_OFFSET_MIN = 6 * 60;

    function toMinutes(hhmm) {                    // "07:00" -> 420
      var p = String(hhmm || '').split(':');
      return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
    }

    var BN_DIGITS = ['\u09E6', '\u09E7', '\u09E8', '\u09E9', '\u09EA', '\u09EB', '\u09EC', '\u09ED', '\u09EE', '\u09EF'];
    var isBn = document.documentElement.lang === 'bn';
    function localiseDigits(s) {
      return isBn ? s.replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; }) : s;
    }
    /* English: "10 PM". Bengali: "\u09B0\u09BE\u09A4 \u09E7\u09E6\u099F\u09BE" — the part of the day comes
       first and the hour takes \u099F\u09BE, which is how the site's own Bengali copy
       already writes opening times. "\u09ED AM" would be neither one language nor
       the other. */
    var BN_PART = [
      [4, '\u09B8\u0995\u09BE\u09B2'],    // 04:00-11:59  morning
      [12, '\u09A6\u09C1\u09AA\u09C1\u09B0'],  // 12:00-15:59  midday
      [16, '\u09AC\u09BF\u0995\u09BE\u09B2'],  // 16:00-17:59  late afternoon
      [18, '\u09B8\u09A8\u09CD\u09A7\u09CD\u09AF\u09BE'], // 18:00-19:59  evening
      [20, '\u09B0\u09BE\u09A4']     // 20:00-03:59  night
    ];
    function bnPartOfDay(h) {
      var part = '\u09B0\u09BE\u09A4';
      for (var i = 0; i < BN_PART.length; i++) if (h >= BN_PART[i][0]) part = BN_PART[i][1];
      return part;
    }
    function clockLabel(mins) {
      var h = Math.floor(mins / 60), m = mins % 60;
      var h12 = h % 12 === 0 ? 12 : h % 12;
      var hm = h12 + (m ? ':' + (m < 10 ? '0' + m : m) : '');
      if (isBn) return bnPartOfDay(h) + ' ' + localiseDigits(hm) + '\u099F\u09BE';
      return hm + ' ' + (h >= 12 ? 'PM' : 'AM');
    }

    function render() {
      var now = new Date();
      var dhakaMins = (now.getUTCHours() * 60 + now.getUTCMinutes() + DHAKA_OFFSET_MIN) % 1440;
      var open = toMinutes(badge.getAttribute('data-open'));
      var close = toMinutes(badge.getAttribute('data-close'));
      var isOpen = dhakaMins >= open && dhakaMins < close;

      badge.firstChild.textContent = isOpen
        ? badge.getAttribute('data-l-open') + ' \u00B7 ' + badge.getAttribute('data-l-until') + ' ' + clockLabel(close)
        : badge.getAttribute('data-l-closed') + ' \u00B7 ' + badge.getAttribute('data-l-opens') + ' ' + clockLabel(open);
      badge.classList.toggle('is-open', isOpen);
      badge.classList.toggle('is-closed', !isOpen);
      badge.hidden = false;
    }

    render();
    setInterval(render, 60000);
  }

  /* ---------- Quote form -> pre-filled WhatsApp message ---------- */
  var form = document.getElementById('quoteForm');
  if (!form) return;

  var strings = {};
  try {
    strings = JSON.parse(document.getElementById('quoteStrings').textContent);
  } catch (e) {
    return; // Without the strings the message would be malformed; leave the form inert.
  }

  /* Arriving from a trade page: /contact.html?for=core-cutting. Matched on the
     option's data-slug, never on its visible text, so it works in both
     languages and survives any wording change. */
  (function preselect() {
    var m = /[?&]for=([A-Za-z0-9_-]{1,40})/.exec(window.location.search);
    if (!m) return;
    var opt = form.querySelector('option[data-slug="' + m[1] + '"]');
    if (opt) opt.selected = true;
  })();

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

    /* Record the request before WhatsApp takes over. sendBeacon hands the body
       to the browser and returns immediately — it cannot delay or block the
       window.open below, and it survives the page being left. fetch+keepalive
       is the fallback for browsers without it. Either way the send is
       fire-and-forget: if it fails, the visitor still reaches WhatsApp, which
       is the behaviour that existed before this was added. */
    recordQuote({
      name: name, phone: phone, category: category, items: items,
      company: form.elements.company ? form.elements.company.value : '',
      lang: document.documentElement.lang || '',
      page: window.location.pathname
    });

    var win = window.open(url, '_blank', 'noopener');
    if (!win) window.location.href = url; // popup blocked — navigate instead
  });

  /* Write the request to Firestore so it survives the WhatsApp chat scrolling
     away. Posted straight to the REST API: loading the Firebase SDK would put a
     third-party script on a public page, and a stalled script on mobile data
     blocks every script behind it.

     No sendBeacon here, unlike the Apps Script endpoint this replaces. Firestore
     needs Content-Type: application/json, which makes the browser send a CORS
     preflight, and a beacon cannot be preflighted. fetch with keepalive survives
     the navigation that window.open causes, which is the only thing the beacon
     was buying. Firestore answers the preflight properly — Apps Script did not,
     which is why that path used text/plain.

     Fails silently, by design: the customer's message has already gone to
     WhatsApp by the time this runs, and a recording problem must never cost them
     the conversation. The cost of that silence is that a too-strict Firestore
     rule also loses leads with nothing shown anywhere, so after changing the
     rules, submit a real request and go and look in Firestore. */
  function recordQuote(payload) {
    var project = form.getAttribute('data-fb-project');
    if (!project) return;   // not configured yet — the form works without it

    /* The honeypot. A human never sees the field, so anything in it came from a
       script filling every input. Dropped here rather than sent: the Firestore
       rules accept a fixed set of keys, so posting the field at all would be
       rejected, and this keeps the junk out of the collection entirely. The
       WhatsApp hand-off still happens — on the slim chance a real person
       somehow filled it, they keep their conversation. */
    if (payload.company) return;

    var collection = form.getAttribute('data-fb-collection') || 'leads';
    try {
      /* Firestore wants every value tagged with its type. Everything here is a
         string; `status` and `source` are pinned to what the rules demand. */
      var fields = {};
      var doc = {
        name: payload.name, phone: payload.phone, category: payload.category,
        items: payload.items, lang: payload.lang, page: payload.page,
        status: 'new', source: 'website', createdAt: new Date().toISOString()
      };
      for (var k in doc) fields[k] = { stringValue: String(doc[k] == null ? '' : doc[k]) };

      fetch('https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(project) +
            '/databases/(default)/documents/' + encodeURIComponent(collection), {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: fields })
      }).catch(function () {});
    } catch (err) { /* never let recording break the WhatsApp hand-off */ }
  }
})();

/* Three taps on the footer mark open the leads dashboard.

   The shop owner reads leads on their phone, where typing a URL is a nuisance
   and a bookmark gets lost in a hundred tabs. The site is already open in front
   of them, so the shortcut lives there.

   The FOOTER mark, not the header brand, for two reasons. The header brand is a
   link to the home page, so repeated taps would navigate away before the count
   reached three — build.js therefore renders the footer one as a plain <span>,
   which is also why no preventDefault is needed here. And the footer sits at the
   very bottom, where nobody arrives by accident.

   This is a shortcut, NOT a secret. /admin/ is a public URL and anyone who taps
   the logo three times finds a login box they cannot get past. What protects the
   leads is Firebase Auth and the Firestore rules, never the obscurity of the
   path. */
(function () {
  var mark = document.querySelector('.footer__mark');
  if (!mark) return;

  var NEEDED = 3;
  var WINDOW_MS = 1600;    // taps further apart than this start a fresh count
  var taps = 0, last = 0;

  mark.addEventListener('click', function () {
    var now = Date.now();
    if (now - last > WINDOW_MS) taps = 0;
    last = now;
    if (++taps < NEEDED) return;
    taps = 0;
    /* data-admin is written by build.js, which is the only thing that knows how
       far up the site root is — '' on a flat page, '../../' from a trade page. */
    window.location.href = (mark.getAttribute('data-admin') || 'admin/');
  });
})();
