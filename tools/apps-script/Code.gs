/**
 * ERA Sanitary — alerts and the daily brief.
 *
 * Two scheduled jobs, both reading Firestore and sending email:
 *
 *   checkNewLeads()  every 10 minutes — a new website quote request is appended
 *                    to the bookings sheet and emailed to the shop.
 *   dailyBrief()     every morning — one email with who owes money and what is
 *                    scheduled for today and tomorrow, each row carrying a
 *                    tap-to-WhatsApp link.
 *
 * WHY THIS EXISTS AT ALL
 *
 * The dashboard at /admin/ only tells the owner anything when they open it, and
 * the free Firebase plan has no Cloud Functions, so nothing else in the stack
 * can run on a timer. Apps Script is the free scheduler. That is the whole
 * reason it is here, and it is why the daily brief — not the lead alert — is
 * the part that could not have been built any other way.
 *
 * WHY IT READS FIRESTORE INSTEAD OF BEING POSTED TO
 *
 * The obvious design is to have the website's quote form post here as well as
 * to Firestore. That was rejected twice over: it puts a second endpoint into
 * public JavaScript, which this project deliberately removed once already, and
 * it would only ever see leads — the daily brief needs JOBS, so it could never
 * be built that way. Reading Firestore directly means the public site does not
 * change at all, and one integration covers both collections.
 *
 * The cost is that alerts arrive on a poll, not instantly: Firestore cannot
 * call a webhook without Cloud Functions. Ten minutes is the trade.
 *
 * THE CREDENTIAL
 *
 * A service account BYPASSES firestore.rules completely — rules govern client
 * and public REST traffic, not Google-authenticated admin traffic. So this key
 * is the most powerful credential in the project and the design earns it down:
 * the service account holds roles/datastore.viewer and nothing wider, and
 * nothing here ever writes to Firestore. The "which leads have I handled"
 * cursor lives in Script Properties for exactly that reason.
 *
 * It lives in Script Properties and never in the repository. See README.md.
 */

/* ---------------------------------------------------------------- config */

var P = PropertiesService.getScriptProperties();

function need(key) {
  var v = P.getProperty(key);
  if (!v) {
    throw new Error('Script Property "' + key + '" is not set. See README.md — ' +
      'this script cannot run until SA_KEY, PROJECT_ID, ALERT_TO and SHEET_ID exist.');
  }
  return v;
}

/**
 * Who gets the lead alerts, which is not always who gets the daily brief.
 *
 * The two emails carry very different things. A new enquiry is work for
 * whoever picks it up first, and more eyes on it is better. The brief is the
 * shop's receivables — every customer who owes money and exactly how much — and
 * that is the shop's own financial position, not something to widen by
 * accident. Sharing one should not silently share the other.
 *
 * So LEAD_ALERT_TO, when set, replaces ALERT_TO for the lead alert only. Left
 * unset, both emails go to ALERT_TO, which is what a one-person shop wants and
 * keeps this change invisible to anyone who does not need it.
 *
 * Either property may be a comma-separated list; MailApp takes several
 * recipients that way. Note the daily quota counts RECIPIENTS, not messages.
 */
function leadAlertTo_() {
  return P.getProperty('LEAD_ALERT_TO') || need('ALERT_TO');
}

var SHOP = 'ERA Sanitary & Plumbing Solutions';
var CUR = '৳';                 // ৳
var LEADS = 'leads';
var JOBS = 'jobs';

/* ------------------------------------------------------------------ auth */

/**
 * An OAuth token for the service account, cached for its hour.
 *
 * Apps Script can sign the JWT itself — computeRsaSha256Signature — so there is
 * no library to add and nothing to keep up to date.
 */
function token_() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('sa_token');
  if (hit) return hit;

  var sa = JSON.parse(need('SA_KEY'));
  var now = Math.floor(Date.now() / 1000);
  var claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  var b64 = function (o) {
    return Utilities.base64EncodeWebSafe(JSON.stringify(o)).replace(/=+$/, '');
  };
  var unsigned = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64(claim);
  var sig = Utilities.base64EncodeWebSafe(
    Utilities.computeRsaSha256Signature(unsigned, sa.private_key)).replace(/=+$/, '');

  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    muteHttpExceptions: true,
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: unsigned + '.' + sig,
    },
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Could not get a token for the service account: ' + res.getContentText());
  }
  var tok = JSON.parse(res.getContentText()).access_token;
  /* Short of the hour it is valid for, so a token is never used in the second
     it expires. */
  cache.put('sa_token', tok, 3300);
  return tok;
}

/* ------------------------------------------------------------- firestore */

/** Note the literal parentheses in (default) — that is the database's real name. */
function fsUrl_(suffix) {
  return 'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent(need('PROJECT_ID')) + '/databases/(default)/documents' + suffix;
}

function fsPost_(suffix, body) {
  var res = UrlFetchApp.fetch(fsUrl_(suffix), {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token_() },
    payload: JSON.stringify(body),
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Firestore refused the read (' + res.getResponseCode() + '): ' +
      res.getContentText());
  }
  return JSON.parse(res.getContentText());
}

/** Firestore tags every value with its type; unwrap back to plain JavaScript. */
function plain_(fields) {
  var out = {};
  for (var k in fields) {
    var v = fields[k];
    if ('stringValue' in v) out[k] = v.stringValue;
    else if ('integerValue' in v) out[k] = Number(v.integerValue);
    else if ('doubleValue' in v) out[k] = Number(v.doubleValue);
    else if ('booleanValue' in v) out[k] = v.booleanValue;
    else if ('nullValue' in v) out[k] = null;
    else if ('arrayValue' in v) {
      out[k] = (v.arrayValue.values || []).map(function (e) {
        return e.mapValue ? plain_(e.mapValue.fields || {}) : plain_({ x: e }).x;
      });
    } else if ('mapValue' in v) out[k] = plain_(v.mapValue.fields || {});
  }
  return out;
}

function runQuery_(collection, where, orderField) {
  var q = { from: [{ collectionId: collection }] };
  if (where) q.where = where;
  if (orderField) q.orderBy = [{ field: { fieldPath: orderField }, direction: 'ASCENDING' }];
  return fsPost_(':runQuery', { structuredQuery: q })
    .filter(function (row) { return row.document; })
    .map(function (row) {
      var o = plain_(row.document.fields || {});
      o.id = row.document.name.split('/').pop();
      return o;
    });
}

/* --------------------------------------------------------------- money --
   MIRRORS src/admin/app.js — paidOf(), dueOf() and round2(). If the rule for
   what a customer owes changes there, it must change here too, or the email and
   the dashboard will quietly disagree about someone's balance, which is worse
   than sending no email at all. Rounded at every boundary for the same reason
   as there: a run of floating-point additions drifts. */

function round2_(n) { return Math.round((Number(n) || 0) * 100) / 100; }

function paidOf_(j) {
  return round2_((j.payments || []).reduce(function (a, p) {
    return a + (Number(p.amount) || 0);
  }, 0));
}

function dueOf_(j) { return round2_((Number(j.total) || 0) - paidOf_(j)); }

function money_(n) {
  var v = round2_(n);
  return (v < 0 ? '-' : '') + CUR + Utilities.formatString('%s',
    Math.abs(v).toFixed(2).replace(/\.00$/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ','));
}

/* ---------------------------------------------------------------- dates --
   Built from local components against the script's timezone, which
   appsscript.json pins to Asia/Dhaka. Using UTC here would put a job entered at
   01:00 Dhaka on the previous day and drop it out of "today" — the same bug
   already guarded against in app.js. */

function ymd_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
function today_() { return ymd_(new Date()); }
function tomorrow_() {
  var d = new Date();
  d.setDate(d.getDate() + 1);
  return ymd_(d);
}

function esc_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** wa.me needs digits only, and no leading +. */
function waNumber_(phone) {
  var d = String(phone || '').replace(/[^0-9]/g, '');
  if (!d) return '';
  if (d.length === 11 && d.charAt(0) === '0') d = '88' + d;   // 01711… -> 8801711…
  return d;
}

function waLink_(phone, text) {
  var n = waNumber_(phone);
  return n ? 'https://wa.me/' + n + '?text=' + encodeURIComponent(text) : '';
}

/* ------------------------------------------------------- new lead alerts */

/**
 * Append every new quote request to the bookings sheet and email the shop.
 *
 * The cursor advances ONLY after the sheet append and the send have both
 * succeeded. Moving it first would lose a lead silently on any failure, which
 * is the one thing this must never do — the same reasoning as recordQuote() in
 * main.js swallowing its errors so a recording problem can never cost the
 * customer their WhatsApp conversation.
 */
function checkNewLeads() {
  var since = P.getProperty('LAST_LEAD_AT') || '1970-01-01T00:00:00.000Z';

  var fresh = runQuery_(LEADS, {
    fieldFilter: {
      field: { fieldPath: 'createdAt' },
      op: 'GREATER_THAN',
      value: { stringValue: since },
    },
  }, 'createdAt');

  if (!fresh.length) return;

  var sheet = SpreadsheetApp.openById(need('SHEET_ID')).getSheets()[0];
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(['Received', 'Name', 'Mobile', 'Category', 'Items',
                     'Language', 'Page', 'Status']);
    sheet.setFrozenRows(1);
  }

  var highWater = since;
  var rows = [];

  fresh.forEach(function (l) {
    sheet.appendRow([l.createdAt || '', l.name || '', l.phone || '',
                     l.category || '', l.items || '',
                     l.lang === 'bn' ? 'Bengali' : 'English',
                     l.page || '', l.status || 'new']);
    rows.push(l);
    if ((l.createdAt || '') > highWater) highWater = l.createdAt;
  });

  var html = '<p>' + rows.length + ' new quote request' + (rows.length > 1 ? 's' : '') +
    ' from the website.</p>' + rows.map(function (l) {
      var wa = waLink_(l.phone, 'Hello, this is ' + SHOP + '. Thank you for your enquiry.');
      return '<table style="border-collapse:collapse;margin:0 0 18px;font-family:sans-serif">' +
        row_('Name', l.name || '—') +
        row_('Mobile', l.phone
          ? esc_(l.phone) + (wa ? ' &nbsp; <a href="' + esc_(wa) + '">WhatsApp</a>' : '')
          : '—', true) +
        row_('Category', l.category || '—') +
        row_('Items', l.items || '—') +
        row_('From', (l.lang === 'bn' ? 'Bengali' : 'English') + ' page') +
        '</table>';
    }).join('');

  /* `name` sets the display name only. The sending ADDRESS is the Google
     account that owns this script and cannot be overridden on a consumer
     account — which is why the script has to be created while signed in as the
     shop's own address, not a personal one. */
  MailApp.sendEmail({
    to: leadAlertTo_(),
    name: SHOP,
    subject: rows.length === 1
      ? 'New quote request — ' + (rows[0].name || rows[0].phone || 'no name given')
      : rows.length + ' new quote requests',
    htmlBody: html,
  });

  /* Only now. */
  P.setProperty('LAST_LEAD_AT', highWater);
}

function row_(label, value, raw) {
  return '<tr>' +
    '<td style="padding:4px 14px 4px 0;color:#666;vertical-align:top">' + esc_(label) + '</td>' +
    '<td style="padding:4px 0">' + (raw ? value : esc_(value)) + '</td></tr>';
}

/* ----------------------------------------------------------- daily brief */

/**
 * One email each morning: who owes money, and what is booked for today and
 * tomorrow. Every row carries a wa.me link already filled in, because Apps
 * Script cannot send WhatsApp messages — there is no free API — so the most it
 * can do is put the message one tap away.
 */
function dailyBrief() {
  var jobs = runQuery_(JOBS).filter(function (j) { return !j.deletedAt; });

  var owing = jobs.filter(function (j) { return dueOf_(j) > 0; })
    .sort(function (a, b) { return dueOf_(b) - dueOf_(a); });

  var t = today_(), tm = tomorrow_();
  var booked = jobs.filter(function (j) { return j.nextDate === t || j.nextDate === tm; })
    .sort(function (a, b) { return String(a.nextDate).localeCompare(String(b.nextDate)); });

  if (!owing.length && !booked.length) return;   // nothing to say; say nothing

  var totalDue = round2_(owing.reduce(function (a, j) { return a + dueOf_(j); }, 0));
  var html = '<div style="font-family:sans-serif">';

  if (owing.length) {
    html += '<h2 style="color:#00578A">Outstanding — ' + esc_(money_(totalDue)) +
      ' across ' + owing.length + '</h2><table style="border-collapse:collapse">';
    owing.forEach(function (j) {
      var due = dueOf_(j);
      var msg = 'Hello, this is ' + SHOP + '. There is ' + money_(due) +
        ' outstanding on your ' + (j.jobTypeLabel || j.items || 'order') +
        '. We would be grateful if you could settle it when convenient. Thank you.';
      var wa = waLink_(j.phone, msg);
      html += '<tr>' +
        '<td style="padding:6px 16px 6px 0"><b>' + esc_(j.name || j.customerId || '—') + '</b><br>' +
          '<span style="color:#666;font-size:13px">' + esc_(j.phone || '') + '</span></td>' +
        '<td style="padding:6px 16px 6px 0;white-space:nowrap"><b>' + esc_(money_(due)) + '</b></td>' +
        '<td style="padding:6px 0">' + (wa ? '<a href="' + esc_(wa) + '">Remind on WhatsApp</a>' : '') + '</td>' +
        '</tr>';
    });
    html += '</table>';
  }

  if (booked.length) {
    html += '<h2 style="color:#00578A;margin-top:28px">Today and tomorrow</h2>' +
      '<table style="border-collapse:collapse">';
    booked.forEach(function (j) {
      html += '<tr>' +
        '<td style="padding:6px 16px 6px 0;white-space:nowrap">' +
          esc_(j.nextDate === t ? 'Today' : 'Tomorrow') + '</td>' +
        '<td style="padding:6px 16px 6px 0"><b>' + esc_(j.name || j.customerId || '—') + '</b><br>' +
          '<span style="color:#666;font-size:13px">' + esc_(j.address || '') + '</span></td>' +
        '<td style="padding:6px 0">' + esc_(j.jobTypeLabel || j.items || '') + '</td>' +
        '</tr>';
    });
    html += '</table>';
  }

  html += '</div>';

  MailApp.sendEmail({
    to: need('ALERT_TO'),
    name: SHOP,
    subject: 'ERA — ' + (owing.length ? money_(totalDue) + ' outstanding' : 'today’s work') +
      (booked.length ? ', ' + booked.length + ' booked' : ''),
    htmlBody: html,
  });
}

/* ------------------------------------------------------------------ setup */

/**
 * Run this ONCE by hand to attach both triggers. Safe to re-run: it clears the
 * script's existing triggers first, so it cannot end up with two of each
 * quietly sending everything twice.
 */
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('checkNewLeads').timeBased().everyMinutes(10).create();
  ScriptApp.newTrigger('dailyBrief').timeBased().atHour(8).everyDays(1).create();
  Logger.log('Triggers set: checkNewLeads every 10 minutes, dailyBrief at 08:00 %s',
    Session.getScriptTimeZone());
}

/**
 * Proves the service account cannot write. This MUST fail with 403. If it
 * succeeds, the IAM role is wider than roles/datastore.viewer and must be
 * narrowed before this script is trusted with a live key.
 */
function assertReadOnly() {
  var res = UrlFetchApp.fetch(fsUrl_('/' + JOBS), {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token_() },
    payload: JSON.stringify({ fields: { name: { stringValue: 'IAM probe' } } }),
  });
  if (res.getResponseCode() === 403) {
    Logger.log('PASS — Firestore refused the write. The key is read-only.');
    return;
  }
  throw new Error('FAIL — the service account was able to write (HTTP ' +
    res.getResponseCode() + '). Its role is too wide. Set it to ' +
    'roles/datastore.viewer and delete anything this just created.');
}
