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
let getFirestore, collection, onSnapshot, query, orderBy, doc, updateDoc;
try {
  ({ initializeApp } = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js'));
  ({ getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } =
    await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js'));
  ({ getFirestore, collection, onSnapshot, query, orderBy, doc, updateDoc } =
    await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js'));
} catch (ex) {
  $('bootErr').textContent =
    'Could not load Firebase from Google. Check the connection and reload this page.';
  $('bootErr').hidden = false;
  throw ex;   // stops the module here; the console keeps the real reason
}

const auth = getAuth(initializeApp(CFG));
const db = getFirestore();
let rows = [];

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
$('search').addEventListener('input', draw);

onAuthStateChanged(auth, (user) => {
  /* A UI gate, not a boundary. Firestore refuses a stranger's read whatever this
     does — this only keeps the page from drawing an empty shell and looking
     broken when the rules are, correctly, saying no. */
  const allowed = user && (!OWNERS.length || OWNERS.includes(user.uid));
  $('signin').hidden = !!allowed;
  $('app').hidden = !allowed;
  if (!allowed) {
    if (user) {
      $('signinErr').textContent = 'That account is signed in but not allowed to read leads. UID: ' + user.uid;
      $('signinErr').hidden = false;
      signOut(auth);
    }
    return;
  }
  /* Ordered by createdAt, the client-written ISO string — see firestore.rules for
     why the server's own createTime is not available here. */
  onSnapshot(query(collection(db, COLL), orderBy('createdAt', 'desc')),
    (snap) => { rows = snap.docs.map(d => ({ id: d.id, ...d.data() })); draw(); },
    (ex) => { $('appErr').textContent = 'Could not read leads: ' + ex.message; $('appErr').hidden = false; });
});

function when(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso || '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function draw() {
  const q = $('search').value.trim().toLowerCase();
  const shown = q ? rows.filter(r =>
    (r.name + ' ' + r.phone + ' ' + r.items + ' ' + r.category).toLowerCase().includes(q)) : rows;

  const tally = STATUSES.map(s => s + ' ' + rows.filter(r => r.status === s).length);
  $('counts').innerHTML = tally.map((t, i) =>
    '<span class="pill pill--' + STATUSES[i] + '">' + esc(t) + '</span>').join('');

  if (!shown.length) {
    $('list').innerHTML = '<p class="muted">' + (rows.length ? 'Nothing matches that.' : 'No leads yet.') + '</p>';
    return;
  }

  $('list').innerHTML = shown.map(r => {
    const tel = String(r.phone || '').replace(/[^0-9+]/g, '');
    const wa = tel.replace(/^\+/, '');
    return '<article class="lead lead--' + esc(r.status) + '">' +
      '<div class="lead__head">' +
        '<h2>' + (esc(r.name) || '<span class="muted">No name</span>') + '</h2>' +
        '<time>' + esc(when(r.createdAt)) + '</time>' +
      '</div>' +
      (r.category ? '<p class="cat">' + esc(r.category) + '</p>' : '') +
      (r.items ? '<p class="items">' + esc(r.items) + '</p>' : '<p class="muted items">No item list</p>') +
      (tel ? '<div class="acts">' +
        '<a class="btn btn--sm" href="tel:' + esc(tel) + '">Call ' + esc(r.phone) + '</a>' +
        '<a class="btn btn--sm btn--ghost" href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">WhatsApp</a>' +
      '</div>' : '<p class="muted">No phone number</p>') +
      '<div class="status" role="group" aria-label="Status">' +
        STATUSES.map(s => '<button type="button" class="chip' + (r.status === s ? ' is-on' : '') +
          '" data-id="' + esc(r.id) + '" data-s="' + s + '">' + s + '</button>').join('') +
      '</div>' +
      '<p class="meta muted">' + esc(r.lang === 'bn' ? 'Bengali page' : 'English page') + ' · ' + esc(r.page || '') + '</p>' +
    '</article>';
  }).join('');
}

/* Delegated, because the list is replaced wholesale on every snapshot. */
$('list').addEventListener('click', async (e) => {
  const b = e.target.closest('.chip');
  if (!b) return;
  try {
    await updateDoc(doc(db, COLL, b.dataset.id), { status: b.dataset.s });
  } catch (ex) {
    $('appErr').textContent = 'Could not change status: ' + ex.message;
    $('appErr').hidden = false;
  }
});
