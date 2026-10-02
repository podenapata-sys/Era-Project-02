/**
 * SUPERSEDED — do not deploy this.
 *
 * Quote requests now go to Firestore instead, which the dashboard reads. See the
 * README's "Recording the request (Firebase)" section. This file was never
 * deployed, and the site no longer posts anywhere it could listen: the form
 * carries data-fb-project, not data-endpoint, so setting this up would record
 * nothing.
 *
 * Kept only as a fallback if Firebase is ever abandoned. Deleting it costs
 * nothing.
 *
 * ---------------------------------------------------------------------------
 *
 * ERA Sanitary — quote requests by email, and a running list in a Sheet.
 *
 * The website has no server. This small Google Apps Script is the server: the
 * quote form on contact.html sends it every request, and it emails the shop and
 * appends a row to a Google Sheet in the owner's own Drive. Nothing is re-typed
 * by anyone, and nothing is lost when a WhatsApp chat scrolls away.
 *
 * The form still opens WhatsApp exactly as it did before. This runs alongside
 * it, never in front of it — the website uses navigator.sendBeacon, which hands
 * the data to the browser and returns immediately, so a slow or broken script
 * here can never delay or block WhatsApp opening.
 *
 * Free: MailApp allows roughly 100 emails a day on a normal Google account,
 * far more than this shop will take in quote requests.
 *
 * ── SETUP (about five minutes, once) ─────────────────────────────────────────
 * 1. Go to script.google.com and press "New project".
 * 2. Delete whatever is in the editor and paste this whole file in.
 * 3. Change TO_EMAIL below to the address that should receive the alerts.
 *    Separate several with commas.
 * 4. Press Deploy → New deployment → choose type "Web app".
 *      Execute as:      Me
 *      Who has access:  Anyone
 *    Press Deploy, then Authorise access and allow it. Google will warn that
 *    the app is not verified — that is normal for your own script. Choose
 *    Advanced → Go to project (unsafe) → Allow.
 * 5. Copy the Web app URL it gives you. It looks like
 *      https://script.google.com/macros/s/AKfy..../exec
 * 6. Paste it into content/business.json as "quoteEndpoint", then rebuild and
 *    push. While that value is empty the website simply skips this step and the
 *    form keeps working.
 * 7. To find the Sheet afterwards: pick quoteSheetUrl in the function dropdown
 *    at the top of the editor and press Run. The link is printed in the log.
 *
 * To test before wiring the website up: pick sendTestAlert from the dropdown
 * and press Run. doPost cannot be run from the editor — there is no request
 * attached to it — so it tells you that instead of failing silently.
 *
 * ── WHY THERE IS NO SECRET TOKEN ─────────────────────────────────────────────
 * Anything the website's JavaScript holds is readable by anyone who opens the
 * page source, so a "secret token" there is not a secret — it is a speed bump
 * that mostly fools the person who added it. This script defends itself instead:
 *
 *   • a honeypot field the form renders off-screen. A human never fills it in;
 *     an automated script that fills every input does. Anything with it set is
 *     dropped without an email.
 *   • hard length limits on every field, so a flood of text cannot be posted
 *     through the form into the inbox or the Sheet.
 *   • per-phone rate limiting, below, so one number cannot fire repeatedly.
 *
 * The worst this endpoint can do, even if someone posts to it directly, is send
 * mail to the one fixed address below and add a row to one Sheet. It can read
 * nothing and change nothing else.
 *
 * ── OAuth scopes this project needs ──────────────────────────────────────────
 *   https://www.googleapis.com/auth/script.send_mail        MailApp
 *   https://www.googleapis.com/auth/spreadsheets            the quotes Sheet
 *   https://www.googleapis.com/auth/drive.file              creating that Sheet
 * Apps Script infers these on first run; just press Allow when asked.
 */

/* Who receives the alerts. Separate several with commas — every one of them
   gets the same email. Google's daily allowance counts RECIPIENTS, not
   messages, so two addresses means two units per request. */
var TO_EMAIL   = 'erasanitary2003@gmail.com';
var SHOP_NAME  = 'ERA Sanitary & Plumbing Solutions';
var SHEET_NAME = 'ERA Sanitary — quote requests';

/* Rate limit: at most this many requests from one phone number in this window.
   A genuine customer correcting a typo and resending is fine; a script hammering
   the endpoint is not. Held in CacheService, which expires entries by itself. */
var RATE_MAX      = 3;
var RATE_WINDOW_S = 600;          // 10 minutes

var SHEET_HEADERS = ['Received', 'Name', 'Phone', 'Category', 'Items', 'Language', 'Page'];

/* Longest value accepted per field. Anything longer is cut, not rejected — a
   real customer with a long item list still gets through with their list mostly
   intact, while a megabyte of junk cannot reach the inbox. */
var LIMITS = { name: 80, phone: 30, category: 120, items: 2000, lang: 8, page: 200 };


/** The website's entry point. */
function doPost(e) {
  try {
    /* Pressing Run on doPost from the editor arrives here with no request. The
       catch below would swallow the error and report success having sent
       nothing, which reads exactly like a broken email. Say so instead. */
    if (!e || !e.postData) {
      console.log('doPost is the website\'s entry point — it cannot be run from the editor, '
                + 'because there is no quote request attached to it.');
      console.log('To test the email: pick sendTestAlert in the dropdown above, then Run.');
      return _ok('no request');
    }

    var d = {};
    try { d = JSON.parse(e.postData.contents) || {}; }
    catch (parseErr) { return _ok('bad json'); }

    /* Honeypot. The form renders this field off-screen with no label a person
       would read; a human leaves it empty. */
    if (_clean(d.company, 100)) return _ok('ignored');

    var phone = _clean(d.phone, LIMITS.phone);
    if (_rateLimited(phone)) return _ok('rate limited');

    var row = {
      when:     new Date(),
      name:     _clean(d.name, LIMITS.name),
      phone:    phone,
      category: _clean(d.category, LIMITS.category),
      items:    _clean(d.items, LIMITS.items),
      lang:     _clean(d.lang, LIMITS.lang),
      page:     _clean(d.page, LIMITS.page)
    };

    /* Written down before anything else. If the mail quota is spent or Gmail is
       having a bad day, the request is still recorded. */
    try { _logQuote(row); } catch (logErr) { console.warn('Sheet log failed: ' + logErr); }

    var to = _recipients();
    if (!to) return _ok('no recipient');   // still in the Sheet, above

    MailApp.sendEmail({
      to: to,
      subject: 'Quote request' + (row.name ? ' — ' + row.name : '')
             + (row.category ? ' (' + row.category + ')' : ''),
      htmlBody: _quoteEmail(row),
      name: SHOP_NAME + ' website'
    });
    return _ok('ok');

  } catch (err) {
    console.error(err);
    return _ok('error');                   // never hand a stack trace to the caller
  }
}

/** A browser may probe the URL with GET. Say something harmless. */
function doGet() {
  return _ok(SHOP_NAME + ' quote endpoint. Post a quote request here.');
}


/* ─────────────────────────────────────────────────────────── the email ── */

function _quoteEmail(r) {
  var rows = [
    ['Name',     r.name  || '(not given)'],
    ['Phone',    r.phone ? '<a href="tel:' + r.phone + '">' + r.phone + '</a>' : '(not given)'],
    ['Category', r.category || '(not specified)'],
    ['Items',    r.items ? r.items.replace(/\n/g, '<br>') : '(none listed)'],
    ['Language', r.lang === 'bn' ? 'Bengali' : 'English'],
    ['Page',     r.page || '—']
  ];
  var body = '<div style="font-family:Arial,sans-serif;font-size:15px;color:#141414">'
    + '<h2 style="color:#0b0b0d;margin:0 0 12px">New quote request from the website</h2>'
    + '<table cellpadding="7" style="border-collapse:collapse">';
  for (var i = 0; i < rows.length; i++) {
    body += '<tr>'
      + '<td style="background:#f2f2f2;font-weight:bold;white-space:nowrap">' + rows[i][0] + '</td>'
      + '<td>' + rows[i][1] + '</td></tr>';
  }
  body += '</table>'
    + '<p style="color:#5a5a5a;font-size:13px;margin-top:16px">'
    + 'The customer was also taken to WhatsApp with this same message ready to send.</p></div>';
  return body;
}

/** TO_EMAIL as MailApp wants it. A trailing comma or a stray line break makes
    MailApp reject the whole send, so anything without an "@" is dropped rather
    than taking the alert down with it. */
function _recipients() {
  return String(TO_EMAIL || '')
    .split(/[,;\s]+/)
    .filter(function (a) { return a.indexOf('@') > 0; })
    .join(',');
}


/* ─────────────────────────────────────────────────────────── the sheet ── */

function _logQuote(r) {
  var sh = _quotesSheet();
  var row = [r.when, r.name, r.phone, r.category, r.items, r.lang, r.page];
  /* Newest first: a shop owner opening this wants today's requests at the top,
     not after two years of scrolling. */
  sh.insertRowBefore(2);
  sh.getRange(2, 1, 1, row.length).setValues([row]);
}

/** The Sheet, made on first use and remembered afterwards. */
function _quotesSheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('QUOTES_SHEET_ID');
  if (id) {
    try { return SpreadsheetApp.openById(id).getSheets()[0]; }
    catch (e) { /* deleted, or in someone's bin — fall through and make a new one */ }
  }
  var ss = SpreadsheetApp.create(SHEET_NAME);
  var sh = ss.getSheets()[0];
  sh.getRange(1, 1, 1, SHEET_HEADERS.length)
    .setValues([SHEET_HEADERS]).setFontWeight('bold').setBackground('#f2f2f2');
  sh.setFrozenRows(1);
  /* Phone as TEXT. A spreadsheet reads 01711954094 as a number and drops the
     leading zero, which makes every Bangladeshi mobile in the file wrong. */
  sh.getRange('C:C').setNumberFormat('@');
  sh.setColumnWidth(1, 150);   // Received
  sh.setColumnWidth(5, 320);   // Items
  props.setProperty('QUOTES_SHEET_ID', ss.getId());
  return sh;
}

/** Run this from the editor to get the link to the Sheet. */
function quoteSheetUrl() {
  var url = _quotesSheet().getParent().getUrl();
  console.log(url);
  return url;
}


/* ────────────────────────────────────────────────── spam and sanitising ── */

/** At most RATE_MAX requests from one phone number per window. A request with no
    phone number is never rate limited — the form allows an item list on its own,
    and dropping those would lose real customers. */
function _rateLimited(phone) {
  if (!phone) return false;
  var key = 'rl_' + phone.replace(/\D/g, '');
  var cache = CacheService.getScriptCache();
  var n = parseInt(cache.get(key), 10) || 0;
  if (n >= RATE_MAX) return true;
  cache.put(key, String(n + 1), RATE_WINDOW_S);
  return false;
}

/** Angle brackets stripped so nothing posted here can inject markup into the
    HTML email, and a hard length cap per field. */
function _clean(v, max) {
  return String(v == null ? '' : v).replace(/[<>]/g, '').slice(0, max || 300).trim();
}

function _ok(msg) {
  return ContentService.createTextOutput(msg).setMimeType(ContentService.MimeType.TEXT);
}


/* ──────────────────────────────────────────────────────────────── tests ── */

/** Pick this in the dropdown and press Run to check the email works. */
function sendTestAlert() {
  var to = _recipients();
  if (!to) { console.log('TO_EMAIL has no usable address in it.'); return; }
  var row = {
    when: new Date(), name: 'Test request', phone: '01711954094',
    category: 'Core cutting', items: '1 inch core cut x 4, 3rd floor',
    lang: 'en', page: '/contact.html'
  };
  _logQuote(row);
  MailApp.sendEmail({ to: to, subject: 'Quote request — Test request (Core cutting)',
                      htmlBody: _quoteEmail(row), name: SHOP_NAME + ' website' });
  console.log('Sent to: ' + to);
  console.log('Sheet:   ' + quoteSheetUrl());
}

/** Prints what is configured, without sending anything. */
function checkAlertSetup() {
  console.log('Recipients : ' + (_recipients() || '(none — fix TO_EMAIL)'));
  console.log('Shop name  : ' + SHOP_NAME);
  console.log('Rate limit : ' + RATE_MAX + ' per phone per ' + (RATE_WINDOW_S / 60) + ' min');
  var id = PropertiesService.getScriptProperties().getProperty('QUOTES_SHEET_ID');
  console.log('Sheet      : ' + (id ? 'created, id ' + id : 'not created yet (made on first request)'));
}
