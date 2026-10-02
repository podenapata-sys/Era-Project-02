/* ERA Sanitary — the leads dashboard.
   https://github.com/podenapata-sys/Era-Project-02

   Served as dist/admin/app.js. It lives in src/admin/ rather than src/assets/
   because build.js copies the whole of src/assets/ into dist/assets/, which is a
   PUBLIC path — this file names the Firebase SDK, and the deploy workflow fails
   the build if `firebasejs` appears anywhere outside dist/admin/. That guard is
   load-bearing: a third-party script on a customer-facing page is exactly what
   RULES.md rule 5 forbids.

   It was a template literal inside build.js until this commit. Nothing about
   that was wrong while the page listed leads and nothing else, but it is about
   to grow jobs, payments and dues, and an application inside a template string
   is unreadable, unlintable, and booby-trapped with every backtick and ${.

   Nothing shop-specific is written here. The shop's name, phone, project and
   owner UIDs arrive in the #adminCfg JSON block that build.js renders, so this
   file is the same for every client the dashboard is stood up for. Keep it that
   way: a literal phone number or a hardcoded currency here is a bug. */

/* Read before anything else. Parsed defensively for the same reason the SDK
   imports below are: both panels ship hidden, so anything that throws up here
   leaves a header above an empty page and no way to tell why. */
let C;
try {
  C = JSON.parse(document.getElementById('adminCfg').textContent);
} catch (ex) {
  const box = document.getElementById('bootErr');
  if (box) {
    box.textContent = 'The dashboard configuration did not load. Rebuild and redeploy the site.';
    box.hidden = false;
  }
  throw ex;
}

const CFG = C.firebase;            // apiKey, authDomain, appId, projectId
const OWNERS = C.owners || [];     // mirrors isOwner() in firestore.rules
const COLL = C.leadsCollection || 'leads';
const WA = C.whatsapp || '';       // the shop's primary WhatsApp number

/* Pinned in firestore.rules too — `status in ['new','called','quoted','won','lost']`.
   Adding a sixth here alone makes the write fail with a permission error. */
const STATUSES = ['new', 'called', 'quoted', 'won', 'lost'];

const JOBS = C.jobsCollection || 'jobs';
const D = C.dashboard || {};
const CUR = D.currency || '';
const LOC = D.numberLocale || 'en-IN';
const PREFIX = D.idPrefix || 'ID';
const BIN_DAYS = Number(D.binDays) > 0 ? Number(D.binDays) : 30;
const SHOP = C.shop || '';
const REMINDER = (C.reminder || {}).bn || (C.reminder || {}).en || '';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

/* Both panels below ship hidden and are unhidden by onAuthStateChanged, so if
   these imports never resolve the owner gets a page with a header and nothing
   else — indistinguishable from the dashboard being broken. On Dhaka mobile
   data that is a realistic Tuesday, so say which thing failed. Version pinned
   deliberately: it only moves when there is a reason to move it. */
let initializeApp;
let getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged;
let initializeFirestore, persistentLocalCache, collection, onSnapshot, query,
    orderBy, doc, updateDoc, addDoc, setDoc, deleteDoc;
try {
  ({ initializeApp } = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'));
  ({ getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } =
    await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'));
  ({ initializeFirestore, persistentLocalCache, collection, onSnapshot, query,
     orderBy, doc, updateDoc, addDoc, setDoc, deleteDoc } =
    await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js'));
} catch (ex) {
  $('bootErr').textContent =
    'Could not load Firebase from Google. Check the connection and reload this page.';
  $('bootErr').hidden = false;
  throw ex;   // stops the module here; the console keeps the real reason
}

const app = initializeApp(CFG);
const auth = getAuth(app);
/* Keeps working on a dead connection, which the shop's is, regularly. Reads come
   from the device and writes queue until it is back. persistentLocalCache is the
   modern form; enableIndexedDbPersistence is deprecated.

   It costs something and the README says so: the cache puts the customer list,
   with addresses and balances, into IndexedDB on that device. Single-tab by
   default — a second tab falls back to memory and still works. */
const db = initializeFirestore(app, { localCache: persistentLocalCache() });

let leads = [], jobs = [];
let view = 'dues', range = 'all', onDate = '', q = '';
let editing = null, paying = null, converting = null;
let unsubLeads = null, unsubJobs = null;

/* ---------- money ----------
   Rounded at every boundary. Totals are summed from a payment log, and a run of
   floating-point additions drifts — 0.1 + 0.2 is the famous one. Nothing here
   should ever show a customer's balance as 6999.999999999999. */
const round2 = n => Math.round((Number(n) || 0) * 100) / 100;
const nf = new Intl.NumberFormat(LOC, { maximumFractionDigits: 2 });
const money = (n) => {
  const v = round2(n);
  return (v < 0 ? '-' : '') + CUR + nf.format(Math.abs(v));
};
const str = v => String(v == null ? '' : v);

const paidOf = j => round2((j.payments || [])
  .reduce((a, p) => a + (Number(p.amount) || 0), 0));
const dueOf = j => round2((Number(j.total) || 0) - paidOf(j));

/* ER-#### from the last four digits of the mobile. A handle for the owner to
   say out loud, not a key — two customers whose numbers end the same get the
   same handle, and that is fine because Firestore's document id is the key. */
function custId(phone) {
  const d = str(phone).replace(/\D/g, '');
  return PREFIX + '-' + (d.length >= 4 ? d.slice(-4) : (d || '0').padStart(4, '0'));
}

/* ---------- dates ----------
   Local components, never toISOString(). Dhaka is UTC+6, so a job entered at
   01:00 would be stamped with yesterday's date by the UTC path, and then not
   show up under Today. */
function isoDay(d) {
  const p = n => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
const today = () => isoDay(new Date());

function when(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return str(iso);
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function dayLabel(ymd) {
  if (!ymd) return '';
  const d = new Date(ymd + 'T00:00:00');
  if (isNaN(d)) return str(ymd);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function inRange(ymd) {
  if (onDate) return ymd === onDate;
  if (range === 'all') return true;
  if (!ymd) return false;
  const now = new Date();
  if (range === 'today') return ymd === today();
  if (range === 'month') return ymd.slice(0, 7) === today().slice(0, 7);
  if (range === 'week') {
    /* Week starts Sunday: Bangladesh works Sunday to Thursday, with Friday and
       Saturday the weekend. A Monday-start week would cut the working week in
       half and make "this week" useless on a Sunday. */
    const start = new Date(now);
    start.setDate(start.getDate() - start.getDay());
    return ymd >= isoDay(start) && ymd <= today();
  }
  return true;
}

const hay = (...parts) => parts.map(str).join(' ').toLowerCase();
const matchJob = j => !q || hay(j.name, j.phone, j.customerId, j.address,
                                j.items, j.jobTypeLabel, j.notes).includes(q);
const matchLead = l => !q || hay(l.name, l.phone, l.items, l.category).includes(q);

/* ---------- writes ----------
   Every write sends the WHOLE document, because validJob() in firestore.rules
   requires all sixteen keys to be present: a half-written job with no total is
   worse than a rejected write. This is the only place that shape is assembled,
   so adding a field means one edit here and one in the rules. */
function shape(j) {
  const now = new Date().toISOString();
  return {
    name: str(j.name), phone: str(j.phone), address: str(j.address),
    customerId: str(j.customerId) || custId(j.phone),
    jobType: str(j.jobType), jobTypeLabel: str(j.jobTypeLabel),
    items: str(j.items), notes: str(j.notes),
    total: round2(j.total),
    payments: (j.payments || []).map(p => ({
      amount: round2(p.amount), date: str(p.date), note: str(p.note),
    })),
    visitDate: str(j.visitDate), nextDate: str(j.nextDate),
    createdAt: str(j.createdAt) || now,
    updatedAt: now,
    deletedAt: str(j.deletedAt),
    leadId: str(j.leadId),
  };
}

function fail(msg, ex) {
  $('appErr').textContent = msg + (ex && ex.message ? ' — ' + ex.message : '');
  $('appErr').hidden = false;
}
const clearFail = () => { $('appErr').hidden = true; };

async function saveJob(id, data) {
  const body = shape(data);
  if (id) await setDoc(doc(db, JOBS, id), body);
  else await addDoc(collection(db, JOBS), body);
}

/* ---------- the bin ----------
   Soft delete, because the owner is doing this one-handed on a phone and a
   stray tap must not destroy what a customer owes. The purge below is a real
   delete and runs on load: there are no Cloud Functions on the free plan, so
   there is nothing else to run it. A dashboard nobody opens therefore never
   purges, which is an acceptable thing for a bin to do. */
let purging = false;
async function purgeBin(list) {
  if (purging) return;      // its own deletes retrigger the snapshot that calls it
  purging = true;
  const cutoff = Date.now() - BIN_DAYS * 86400000;
  for (const j of list) {
    if (!j.deletedAt) continue;
    const t = Date.parse(j.deletedAt);
    /* An unparseable stamp is left alone on purpose. Treating it as ancient
       would delete a row for being malformed, which is the opposite of what a
       bin is for. */
    if (!Number.isFinite(t) || t >= cutoff) continue;
    try { await deleteDoc(doc(db, JOBS, j.id)); } catch (ex) { /* next load */ }
  }
  purging = false;
}

/* ---------- render ---------- */
function visibleJobs() {
  const live = jobs.filter(j => !j.deletedAt);
  if (view === 'bin') return jobs.filter(j => j.deletedAt).filter(matchJob)
    .sort((a, b) => str(b.deletedAt).localeCompare(str(a.deletedAt)));
  if (view === 'dues') return live.filter(j => dueOf(j) > 0).filter(matchJob)
    .sort((a, b) => dueOf(b) - dueOf(a));            // biggest debt first
  return live.filter(j => inRange(j.visitDate)).filter(matchJob)
    .sort((a, b) => str(b.visitDate).localeCompare(str(a.visitDate)));
}

function drawStats(list) {
  const billed = round2(list.reduce((a, j) => a + (Number(j.total) || 0), 0));
  const got = round2(list.reduce((a, j) => a + paidOf(j), 0));
  const owed = round2(list.reduce((a, j) => a + Math.max(0, dueOf(j)), 0));
  const cards = [
    ['Jobs', String(list.length)],
    ['Billed', money(billed)],
    ['Collected', money(got)],
    ['Outstanding', money(owed)],
  ];
  $('stats').innerHTML = cards.map(([k, v]) =>
    '<div class="stat"><span class="stat__k">' + esc(k) + '</span>' +
    '<strong class="stat__v">' + esc(v) + '</strong></div>').join('');
}

function jobCard(j) {
  const due = dueOf(j), paid = paidOf(j);
  const tel = str(j.phone).replace(/[^0-9+]/g, '');
  const wa = tel.replace(/^\+/, '');
  const binned = !!j.deletedAt;
  /* Four states, not three. An overpayment is not the same as settled — it
     means somebody paid too much and the shop owes a refund or a credit, which
     is worth noticing rather than colouring green and forgetting. */
  const state = binned ? 'binned' : due > 0 ? 'due' : due < 0 ? 'over' : 'clear';

  const msg = REMINDER
    .replace('{shop}', SHOP)
    .replace('{job}', str(j.jobTypeLabel) || str(j.items))
    .replace('{amount}', bnDigits(money(due)));

  return '<article class="job job--' + state + '">' +
    '<div class="lead__head">' +
      '<h2>' + (esc(j.name) || '<span class="muted">No name</span>') +
        ' <span class="cid">' + esc(j.customerId) + '</span></h2>' +
      '<time>' + esc(dayLabel(j.visitDate)) + '</time>' +
    '</div>' +
    (j.jobTypeLabel ? '<p class="cat">' + esc(j.jobTypeLabel) + '</p>' : '') +
    (j.items ? '<p class="items">' + esc(j.items) + '</p>' : '') +
    '<div class="mon">' +
      '<span>Total <b>' + esc(money(j.total)) + '</b></span>' +
      '<span>Paid <b>' + esc(money(paid)) + '</b></span>' +
      '<span class="mon__due">' + (due < 0
        ? 'Overpaid <b>' + esc(money(-due)) + '</b>'
        : 'Due <b>' + esc(money(due)) + '</b>') + '</span>' +
    '</div>' +
    (j.address ? '<p class="meta muted">' + esc(j.address) + '</p>' : '') +
    (j.nextDate ? '<p class="meta next">Next: ' + esc(dayLabel(j.nextDate)) + '</p>' : '') +
    '<div class="acts">' +
      (binned
        ? '<button class="btn btn--sm" type="button" data-act="restore" data-id="' + esc(j.id) + '">Restore</button>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-act="purge" data-id="' + esc(j.id) + '">Delete for good</button>'
        : (tel ? '<a class="btn btn--sm" href="tel:' + esc(tel) + '">Call</a>' : '') +
          (tel && due > 0 && msg
            ? '<a class="btn btn--sm" target="_blank" rel="noopener" href="https://wa.me/' + esc(wa) +
              '?text=' + encodeURIComponent(msg) + '">Remind</a>' : '') +
          (tel && due <= 0 ? '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="https://wa.me/' + esc(wa) + '">WhatsApp</a>' : '') +
          (due > 0 ? '<button class="btn btn--sm" type="button" data-act="pay" data-id="' + esc(j.id) + '">Payment</button>' : '') +
          '<button class="btn btn--ghost btn--sm" type="button" data-act="edit" data-id="' + esc(j.id) + '">Edit</button>' +
          '<button class="btn btn--ghost btn--sm" type="button" data-act="bin" data-id="' + esc(j.id) + '">Delete</button>') +
    '</div>' +
  '</article>';
}

/* Bengali numerals for the reminder, because the sentence around them is
   Bengali and the site already writes its own numbers this way. The tel: link
   keeps Latin digits — this only touches text a person reads. */
const BN = ['০','১','২','৩','৪','৫','৬','৭','৮','৯'];
const bnDigits = s => str(s).replace(/[0-9]/g, d => BN[+d]);

function leadCard(r) {
  const tel = str(r.phone).replace(/[^0-9+]/g, '');
  const wa = tel.replace(/^\+/, '');
  return '<article class="lead lead--' + esc(r.status) + '">' +
    '<div class="lead__head">' +
      '<h2>' + (esc(r.name) || '<span class="muted">No name</span>') + '</h2>' +
      '<time>' + esc(when(r.createdAt)) + '</time>' +
    '</div>' +
    (r.category ? '<p class="cat">' + esc(r.category) + '</p>' : '') +
    (r.items ? '<p class="items">' + esc(r.items) + '</p>' : '<p class="muted items">No item list</p>') +
    '<div class="acts">' +
      (tel ? '<a class="btn btn--sm" href="tel:' + esc(tel) + '">Call ' + esc(r.phone) + '</a>' +
             '<a class="btn btn--ghost btn--sm" href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a>'
           : '<span class="muted">No phone number</span>') +
      '<button class="btn btn--ghost btn--sm" type="button" data-lead="' + esc(r.id) + '">Make job</button>' +
    '</div>' +
    '<div class="status" role="group" aria-label="Status">' +
      STATUSES.map(s => '<button type="button" class="chip' + (r.status === s ? ' is-on' : '') +
        '" data-id="' + esc(r.id) + '" data-s="' + s + '">' + s + '</button>').join('') +
    '</div>' +
    '<p class="meta muted">' + esc(r.lang === 'bn' ? 'Bengali page' : 'English page') + ' · ' + esc(r.page || '') + '</p>' +
  '</article>';
}

const EMPTY = {
  dues: ['Nothing matches that.', 'Nobody owes anything.'],
  jobs: ['Nothing matches that.', 'No jobs in this range yet.'],
  leads: ['Nothing matches that.', 'No leads yet.'],
  bin: ['Nothing matches that.', 'The bin is empty.'],
};

function draw() {
  const isLeads = view === 'leads';
  $('rangeBar').hidden = !(view === 'jobs' || isLeads);
  $('stats').hidden = isLeads;
  $('counts').hidden = !isLeads;
  $('addJob').hidden = view === 'bin';

  let shown, html;
  if (isLeads) {
    shown = leads.filter(matchLead).filter(l => inRange(str(l.createdAt).slice(0, 10)));
    const tally = STATUSES.map(s => s + ' ' + leads.filter(r => r.status === s).length);
    $('counts').innerHTML = tally.map((t, i) =>
      '<span class="pill pill--' + STATUSES[i] + '">' + esc(t) + '</span>').join('');
    html = shown.map(leadCard).join('');
  } else {
    shown = visibleJobs();
    drawStats(shown);      // the cards describe what is on screen, search included
    html = shown.map(jobCard).join('');
  }

  if (!shown.length) {
    const [onSearch, onNone] = EMPTY[view];
    $('list').innerHTML = '<p class="muted">' + esc(q ? onSearch : onNone) + '</p>';
    return;
  }
  $('list').innerHTML = html;
}

/* ---------- dialogs ---------- */
/* `from` is a lead being turned into a job. Its category is dropped into the
   notes rather than guessed at in the dropdown: the lead carries the category in
   whichever language the customer was reading, so matching it to an English
   option would work for half the enquiries and silently mislabel the other half.
   The owner picks the type; nothing from the enquiry is lost. */
function openJob(j, from) {
  const f = $('jobForm');
  editing = j ? j.id : null;
  converting = from ? from.id : null;
  if (from) j = {
    name: from.name, phone: from.phone, items: from.items,
    notes: 'From the website' + (from.category ? ' \u2014 ' + from.category : ''),
    visitDate: today(), leadId: from.id,
  };
  $('jobDlgTitle').textContent = from ? 'New job from enquiry' : j ? 'Edit job' : 'New job';
  $('jobErr').hidden = true;
  const el = f.elements;
  el.name.value = str(j && j.name);
  el.phone.value = str(j && j.phone);
  el.address.value = str(j && j.address);
  /* A job can carry a type that is no longer in the dropdown — a category
     renamed or dropped from content/ since the job was written. Selecting a
     value the <select> does not have leaves it on the FIRST option, so opening
     such a job and saving a change to its total would quietly relabel the work.
     Put the job's own type back in the list instead, marked so it is removed
     again next time the dialog opens. */
  const sel = el.jobType;
  sel.querySelectorAll('option[data-adhoc]').forEach(o => o.remove());
  /* A job always carries its slug and its label together, because shape()
     writes them together — so matching on the slug alone is enough here. */
  const wantV = str(j && j.jobType), wantL = str(j && j.jobTypeLabel);
  if ((wantV || wantL) && !Array.from(sel.options).some(o => o.value === wantV)) {
    const o = document.createElement('option');
    o.value = wantV;
    o.textContent = wantL || wantV;
    o.setAttribute('data-adhoc', '');
    sel.appendChild(o);
  }
  sel.value = (wantV || wantL) ? wantV : sel.options[0].value;
  el.items.value = str(j && j.items);
  el.total.value = j ? round2(j.total) : 0;
  el.visitDate.value = str(j && j.visitDate) || today();
  el.nextDate.value = str(j && j.nextDate);
  el.notes.value = str(j && j.notes);
  $('jobDlg').showModal();
}

function openPay(j) {
  paying = j.id;
  $('payErr').hidden = true;
  $('payFor').textContent = (j.name || j.customerId) + ' · ' + money(dueOf(j)) + ' outstanding';
  const el = $('payForm').elements;
  el.amount.value = round2(dueOf(j));   // the common case is settling in full
  el.date.value = today();
  el.note.value = '';
  $('payDlg').showModal();
}

/* ---------- events ---------- */
$('signin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('signinErr'); err.hidden = true;
  try {
    await signInWithEmailAndPassword(auth, $('email').value.trim(), $('pass').value);
  } catch (ex) {
    /* Firebase's own messages name the failure precisely enough to act on. */
    err.textContent = ex.code === 'auth/invalid-credential'
      ? 'Wrong email or password.' : ex.message;
    err.hidden = false;
  }
});

$('signout').addEventListener('click', () => signOut(auth));
$('search').addEventListener('input', () => { q = $('search').value.trim().toLowerCase(); draw(); });
$('onDate').addEventListener('input', () => { onDate = $('onDate').value; draw(); });
$('addJob').addEventListener('click', () => openJob(null, null));
$('exportCsv').addEventListener('click', exportCsv);

/* ---------- export ----------
   Whatever is on screen, as a CSV that opens in Excel. Two things Excel does
   have to be worked around, and both of them matter here:

   Without a byte-order mark it reads the file as the system's legacy encoding,
   which turns every Bengali name into mojibake. The \ufeff below is that mark.

   And it strips the leading zero from anything that looks like a number, which
   ruins every Bangladeshi mobile — 01711954094 becomes 1711954094, and the
   column is useless for the one thing it exists for. The ="..." form keeps it a
   string; Google Sheets and LibreOffice understand it too. Applied only to the
   phone column, because it is ugly and nothing else needs it.

   Amounts go out as bare numbers with no currency symbol, so the columns add up
   in the spreadsheet. A column of "৳12,000" is text, and text does not sum. */
function csvCell(v) {
  return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
}
function csvTel(v) {
  return '="' + String(v == null ? '' : v).replace(/"/g, '') + '"';
}

function exportCsv() {
  let head, rows, what;
  if (view === 'leads') {
    what = 'enquiries';
    head = ['Received', 'Name', 'Mobile', 'Category', 'Items', 'Status', 'Language', 'Page'];
    rows = leads.filter(matchLead)
      .filter(l => inRange(str(l.createdAt).slice(0, 10)))
      .map(l => [csvCell(l.createdAt), csvCell(l.name), csvTel(l.phone),
                 csvCell(l.category), csvCell(l.items), csvCell(l.status),
                 csvCell(l.lang), csvCell(l.page)]);
  } else {
    what = view;
    head = ['Customer ID', 'Name', 'Mobile', 'Address', 'Type', 'Items',
            'Total', 'Paid', 'Due', 'Date', 'Next', 'Notes'];
    rows = visibleJobs().map(j => [
      csvCell(j.customerId), csvCell(j.name), csvTel(j.phone), csvCell(j.address),
      csvCell(j.jobTypeLabel), csvCell(j.items),
      csvCell(round2(j.total)), csvCell(paidOf(j)), csvCell(dueOf(j)),
      csvCell(j.visitDate), csvCell(j.nextDate), csvCell(j.notes),
    ]);
  }

  const text = '\ufeff' + [head.map(csvCell).join(',')]
    .concat(rows.map(r => r.join(','))).join('\r\n') + '\r\n';

  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = what + '-' + today() + '.csv';
  a.click();
  /* Not revoked immediately: in some browsers that cancels the download before
     it has read the blob. */
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

document.querySelector('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('.tab');
  if (!b) return;
  view = b.dataset.view;
  document.querySelectorAll('.tab').forEach(t => {
    const on = t === b;
    t.classList.toggle('is-on', on);
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
  draw();
});

$('rangeBar').addEventListener('click', (e) => {
  const b = e.target.closest('.chip[data-range]');
  if (!b) return;
  range = b.dataset.range;
  onDate = ''; $('onDate').value = '';
  $('rangeBar').querySelectorAll('.chip').forEach(c => c.classList.toggle('is-on', c === b));
  draw();
});

for (const id of ['jobDlg', 'payDlg']) {
  $(id).addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) $(id).close();
  });
}

$('jobForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  /* form.elements, never form.X — HTMLFormElement has its own `name` property
     and it shadows the input called "name", so f.name is the form's name
     attribute and f.name.value throws. main.js hits the same wall. */
  const f = e.target.elements;
  const name = f.name.value.trim(), phone = f.phone.value.trim();
  if (!name && !phone) {
    $('jobErr').textContent = 'Give at least a name or a mobile number, or the job cannot be found again.';
    $('jobErr').hidden = false;
    return;
  }
  const total = Number(f.total.value);
  if (!Number.isFinite(total) || total < 0) {
    $('jobErr').textContent = 'The total must be a number, and not negative.';
    $('jobErr').hidden = false;
    return;
  }
  const was = editing ? jobs.find(j => j.id === editing) : null;
  const opt = f.jobType.selectedOptions[0];
  try {
    await saveJob(editing, {
      ...(was || {}),
      name, phone, address: f.address.value.trim(),
      customerId: custId(phone),
      jobType: f.jobType.value,
      /* The placeholder option carries no label — an unset type records as
         empty, not as the words "Not set". */
      jobTypeLabel: opt && opt.value ? opt.textContent : '',
      items: f.items.value.trim(), notes: f.notes.value.trim(),
      total,
      visitDate: f.visitDate.value, nextDate: f.nextDate.value,
      payments: was ? was.payments : [],
      createdAt: was ? was.createdAt : '',
      deletedAt: was ? was.deletedAt : '',
      leadId: was ? was.leadId : (converting || ''),
    });
    /* Marking the enquiry won is a second write that can fail on its own. The
       job is already saved by then, so a failure here must not look like the
       whole thing failed — it is reported on the page and the job stays. The
       link is stored on the JOB, so nothing is lost if this never lands. */
    if (converting) {
      try {
        await updateDoc(doc(db, COLL, converting), { status: 'won' });
      } catch (ex) {
        fail('Job saved, but the enquiry could not be marked won', ex);
      }
      converting = null;
    }
    clearFail();
    $('jobDlg').close();
  } catch (ex) {
    $('jobErr').textContent = 'Could not save: ' + ex.message;
    $('jobErr').hidden = false;
  }
});

$('payForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const j = jobs.find(x => x.id === paying);
  if (!j) { $('payDlg').close(); return; }
  const f = e.target.elements;
  const amount = round2(f.amount.value);
  if (!(amount > 0)) {
    $('payErr').textContent = 'Enter an amount greater than zero.';
    $('payErr').hidden = false;
    return;
  }
  try {
    await saveJob(j.id, {
      ...j,
      payments: (j.payments || []).concat([{
        amount, date: f.date.value || today(), note: f.note.value.trim(),
      }]),
    });
    clearFail();
    $('payDlg').close();
  } catch (ex) {
    $('payErr').textContent = 'Could not record it: ' + ex.message;
    $('payErr').hidden = false;
  }
});

/* Delegated, because the list is replaced wholesale on every snapshot. */
$('list').addEventListener('click', async (e) => {
  const chip = e.target.closest('.chip[data-s]');
  if (chip) {
    try {
      await updateDoc(doc(db, COLL, chip.dataset.id), { status: chip.dataset.s });
      clearFail();
    } catch (ex) { fail('Could not change status', ex); }
    return;
  }

  const mk = e.target.closest('[data-lead]');
  if (mk) {
    const lead = leads.find(l => l.id === mk.dataset.lead);
    if (lead) openJob(null, lead);
    return;
  }

  const b = e.target.closest('[data-act]');
  if (!b) return;
  const j = jobs.find(x => x.id === b.dataset.id);
  if (!j) return;

  try {
    if (b.dataset.act === 'edit') { openJob(j); return; }
    if (b.dataset.act === 'pay') { openPay(j); return; }
    if (b.dataset.act === 'bin') {
      await saveJob(j.id, { ...j, deletedAt: new Date().toISOString() });
    } else if (b.dataset.act === 'restore') {
      await saveJob(j.id, { ...j, deletedAt: '' });
    } else if (b.dataset.act === 'purge') {
      if (!window.confirm('Delete this permanently? It cannot be undone.')) return;
      await deleteDoc(doc(db, JOBS, j.id));
    }
    clearFail();
  } catch (ex) { fail('Could not do that', ex); }
});

onAuthStateChanged(auth, (user) => {
  /* A UI gate, not a boundary. Firestore refuses a stranger's read whatever this
     does — this only keeps the page from drawing an empty shell and looking
     broken when the rules are, correctly, saying no. */
  const allowed = user && (!OWNERS.length || OWNERS.includes(user.uid));
  $('signin').hidden = !!allowed;
  $('app').hidden = !allowed;

  if (!allowed) {
    if (unsubLeads) { unsubLeads(); unsubLeads = null; }
    if (unsubJobs) { unsubJobs(); unsubJobs = null; }
    leads = []; jobs = [];
    if (user) {
      $('signinErr').textContent = 'That account is signed in but not allowed to read leads. UID: ' + user.uid;
      $('signinErr').hidden = false;
      signOut(auth);
    }
    return;
  }

  /* Ordered by createdAt, the client-written ISO string — see firestore.rules for
     why the server's own createTime is not available here. */
  unsubLeads = onSnapshot(query(collection(db, COLL), orderBy('createdAt', 'desc')),
    (snap) => { leads = snap.docs.map(d => ({ id: d.id, ...d.data() })); draw(); },
    (ex) => fail('Could not read leads', ex));

  unsubJobs = onSnapshot(collection(db, JOBS),
    (snap) => {
      jobs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      draw();
      purgeBin(jobs);
    },
    (ex) => fail('Could not read jobs', ex));
});
