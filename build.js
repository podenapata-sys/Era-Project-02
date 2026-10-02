#!/usr/bin/env node
/**
 * ERA Sanitary & Plumbing Solutions — static site generator.
 *
 * Reads content/business.json (facts) and content/copy.json (bilingual copy)
 * and writes dist/ : four pages in English at the root, the same four in
 * Bengali under /bn/, cross-linked with hreflang so both languages are
 * crawlable. No dependencies — Node built-ins only.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');
const biz = require('./content/business.json');
const copy = require('./content/copy.json');
const reviews = require('./content/reviews.json');

/* Absolute URLs (canonical, hreflang, Open Graph, sitemap, robots) need the
   real origin. SITE_URL overrides content/business.json so a Pages or preview
   build advertises itself rather than the production domain. */
const SITE = (process.env.SITE_URL || biz.url).replace(/\/+$/, '');

const PAGES = ['home', 'products', 'services', 'about', 'contact'];
const FILE = { home: 'index.html', products: 'products.html', services: 'services.html', about: 'about.html', contact: 'contact.html' };

/* Trade pages live one level deeper, at /services/<slug>/ and /bn/services/<slug>/.
   Every link in header() and footer() was a bare filename, which only resolves
   while every page sits in its language root. `up` is the hop back to that root:
   '' for the five flat pages — so their output is unchanged — and '../../' for a
   trade page. Asset URLs keep using `base`, which is relative to the site root. */
const TRADE_DIR = 'services';
const upFor = page => (page === 'trade' ? '../../' : '');

const ETC = new Set(['etc.', 'ইত্যাদি']);

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const attr = esc;
const primary = biz.phones.find(p => p.primary) || biz.phones[0];
const addressLine = `${biz.address.street}, ${biz.address.locality}, ${biz.address.region}-${biz.address.postalCode}, ${biz.address.countryName}`;
// The client's own Google listing. Previously this was a name+address search,
// which asks Google to guess which pin is meant — on a road of numbered plots
// that can land somewhere else entirely.
const mapsUrl = biz.maps
  ? biz.maps.placeUrl
  : 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${biz.name}, ${addressLine}`);
const directionsUrl = (biz.maps && biz.maps.directionsUrl) || mapsUrl;
const waLink = (text, phone) => `https://wa.me/${(phone || primary).whatsapp}?text=${encodeURIComponent(text)}`;

/* ------------------------------------------------------------------ icons */
const icon = (d, opts = {}) =>
  `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true" class="ic${opts.cls ? ' ' + opts.cls : ''}">${d}</svg>`;

const ICONS = {
  pin: icon('<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="10" r="2.6" stroke="currentColor" stroke-width="1.7"/>'),
  phone: icon('<path d="M6.5 3h3l1.5 4-2 1.5a12 12 0 0 0 6.5 6.5L17 13l4 1.5v3a2.5 2.5 0 0 1-2.7 2.5C10.6 19.6 4.4 13.4 4 5.7A2.5 2.5 0 0 1 6.5 3Z" fill="currentColor"/>'),
  whatsapp: icon('<path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9 8.5c0 3.5 3 6.5 6.5 6.5l.9-1.6-2-.9-.9 1a6 6 0 0 1-2.5-2.5l1-.9-.9-2Z" fill="currentColor"/>'),
  clock: icon('<circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l3 1.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'),
  truck: icon('<path d="M2.5 7.5h10v9h-10zM12.5 11h4l3 3v2.5h-7z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="6" cy="17.5" r="1.8" stroke="currentColor" stroke-width="1.7"/><circle cx="16.5" cy="17.5" r="1.8" stroke="currentColor" stroke-width="1.7"/>'),
  check: icon('<path d="m5 12.5 4.2 4.2L19 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'),
  arrow: icon('<path d="M4 12h15m-5-5.5L19.5 12 14 17.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>'),
  store: icon('<path d="M4 9.5V20h16V9.5" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M3 5.5h18l-1 4H4z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M10 20v-5.5h4V20" stroke="currentColor" stroke-width="1.7"/>'),
  card: icon('<rect x="3" y="5.5" width="18" height="13" rx="2.4" stroke="currentColor" stroke-width="1.7"/><path d="M3 10h18" stroke="currentColor" stroke-width="1.7"/>'),
  tools: icon('<path d="M14.8 4.4a4.7 4.7 0 0 0-5.7 6.1l-5 5a1.9 1.9 0 0 0 0 2.7l1.7 1.7a1.9 1.9 0 0 0 2.7 0l5-5a4.7 4.7 0 0 0 6.1-5.7l-2.9 2.9-2.7-.7-.7-2.7Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>'),
  mail: icon('<rect x="3" y="5.5" width="18" height="13" rx="2.4" stroke="currentColor" stroke-width="1.7"/><path d="m4 7.5 8 5.5 8-5.5" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>'),
  star: icon('<path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.8l5.9-.9L12 3.6Z" fill="currentColor"/>'),
};

/* The rest of the site writes its numbers in Bengali script, so a figure that
   comes out of reviews.json has to be converted rather than left in ASCII —
   "4.8" beside "১৪" on the same page reads as a mistake. */
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const bnNum = s => String(s).replace(/[0-9]/g, d => BN_DIGITS[+d]);
const toAsciiDigits = s => String(s).replace(/[০-৯]/g, d => BN_DIGITS.indexOf(d));
const num = (v, lang) => (lang === 'bn' ? bnNum(v) : String(v));

/* Month names live here rather than in copy.json: they are not marketing copy
   the client would ever want to reword, and putting twenty-four strings in the
   bilingual file would bury the parts that are. */
const MONTHS = {
  en: ['January', 'February', 'March', 'April', 'May', 'June',
       'July', 'August', 'September', 'October', 'November', 'December'],
  bn: ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
       'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'],
};

/* ------------------------------------------------------------- components */
function logoMark(base) {
  return `<span class="logo"><img src="${base}${biz.images.logo}" alt="" width="44" height="44" loading="eager" decoding="async"></span>`;
}

/* Every shape a photograph is rendered at, and the widths written for it. The
   same table exists in tools/add-photos.py, which is what actually cuts the
   files; change one and you must change the other. Nothing here can read that
   script to confirm it, but a width missing from disk is simply left out of the
   srcset below, so a disagreement degrades rather than breaking the page. */
const RENDITIONS = {
  hero:  { w: 4,  h: 3,  widths: [720, 1440], sizes: '(max-width: 900px) 100vw, 46vw' },
  wide:  { w: 5,  h: 4,  widths: [640, 1280], sizes: '(max-width: 900px) 100vw, 42vw' },
  card:  { w: 16, h: 9,  widths: [400, 800],  sizes: '(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 25vw' },
  sq43:  { w: 4,  h: 3,  widths: [400, 800, 1120], sizes: '(max-width: 700px) 100vw, (max-width: 1100px) 50vw, 33vw' },
  trade: { w: 16, h: 10, widths: [720, 1440], sizes: '(max-width: 900px) 100vw, 62vw' },
};

const PHOTO_DIR = path.join(ROOT, 'src', 'assets', 'img', 'photos');
const photos = fs.existsSync(path.join(ROOT, 'content', 'photos.json'))
  ? require('./content/photos.json') : {};

/* The alt text for a photograph. Only the three shop photos need their own
   entry in photos.json; a category or trade photo describes itself with the
   title already in copy.json, in whichever language the page is being written
   in, so there is nothing to translate twice and nothing to fall out of step. */
function photoAlt(key, lang, label) {
  const alt = (photos[key] || {}).alt;
  return (alt && alt[lang]) || label;
}

/* Five stars, filled to the score. The row is one image to a screen reader with
   the score spoken as words, rather than five separate stars it would announce
   one after another — and the shape alone never carries the meaning, because
   the number is printed beside it either way. */
function starRow(score, lang) {
  const full = Math.round(score);
  const stars = [1, 2, 3, 4, 5]
    .map(n => `<span class="star${n <= full ? ' is-on' : ''}">${ICONS.star}</span>`).join('');
  /* Spoken in the page's own script, so the Bengali page does not read out
     "4.8" beside a printed ৪.৮. */
  const label = `${num(score, lang)} / ${num(5, lang)}`;
  return `<span class="stars" role="img" aria-label="${attr(label)}">${stars}</span>`;
}

/* Where a quote request is recorded. The form posts one Firestore document over
   the REST API — no Firebase SDK, no library, nothing third-party loaded on a
   public page, which is the rule this site is built on. The project ID is not a
   secret: it is half of a public URL, and what protects the data is the rules in
   firestore.rules, where read is gated on a UID allowlist.

   Empty projectId renders no attributes at all, so main.js finds nothing to post
   to and the form behaves exactly as it does today. */
const fb = () => biz.firebase || {};
function fbAttrs() {
  const { projectId, leadsCollection } = fb();
  if (!projectId) return '';
  return ` data-fb-project="${attr(projectId)}" data-fb-collection="${attr(leadsCollection || 'leads')}"`;
}

/* Real Google reviews, kept in content/reviews.json and copied in by hand.
   Empty until the client pastes some in, and the whole section is omitted
   rather than rendering an empty shell or, worse, a placeholder review.

   Deliberately NOT added to the JSON-LD. Google's structured data policy
   disallows self-serving review markup — a business marking up reviews of
   itself, on its own site — and LocalBusiness is exactly the case it names.
   Adding aggregateRating here would look like an SEO win and risks a manual
   action instead. These are for people reading the page, not for the crawler. */
function reviewsSection(t, lang) {
  if (!reviews.items.length) return '';

  const cards = reviews.items.map(r => {
    const [y, m] = r.date.split('-');
    const when = `${MONTHS[lang][+m - 1]} ${num(y, lang)}`;
    return `
      <figure class="rev">
        ${starRow(r.rating, lang)}
        <blockquote>${esc(r.text)}</blockquote>
        <figcaption>${esc(r.author)}<span>${esc(when)}</span></figcaption>
      </figure>`;
  }).join('');

  /* The headline score only appears when the client has filled it in, so the
     site never states a rating that nobody has checked against Google. */
  const summary = reviews.rating == null ? '' : `
      <p class="revs__score">
        ${starRow(reviews.rating, lang)}
        <strong>${esc(num(reviews.rating, lang))}</strong>
        ${reviews.count == null ? '' : `<span>${esc(num(reviews.count, lang))} ${esc(t.reviewsCount)}</span>`}
      </p>`;

  const all = reviews.url ? `
      <a class="link-more" href="${attr(reviews.url)}" target="_blank" rel="noopener">${esc(t.reviewsAll)} ${ICONS.arrow}</a>` : '';

  return `
<section class="section revs">
  <div class="shell">
    <header class="section-head">
      <h2>${ICONS.star}${esc(t.reviewsTitle)}</h2>
      ${all}
    </header>
    ${summary}
    <div class="revs__grid">${cards}</div>
  </div>
</section>
`;
}

/* A photograph where one exists, and the labelled placeholder where one does
   not. The client's photography arrives in instalments, so this has to read
   well in both states and at every point between: a slot lights up the moment
   its file is on disk, and the rest keep the layout honest meanwhile.

   The placeholder branch emits exactly what it always did, byte for byte, so
   this can ship before a single photograph exists without touching the site. */
function photo(key, rend, lang, base, label, cls) {
  const spec = RENDITIONS[rend];
  const stem = `${key}-${rend}-`;
  const have = spec.widths.filter(w =>
    fs.existsSync(path.join(PHOTO_DIR, `${stem}${w}.webp`)));

  if (!have.length) {
    return `<div class="slot${cls ? ' ' + cls : ''}" role="img" aria-label="${attr(label)}"><span>${esc(label)}</span></div>`;
  }

  const url = (w, ext) => `${base}assets/img/photos/${stem}${w}.${ext}`;
  const webp = have.map(w => `${url(w, 'webp')} ${w}w`).join(', ');
  const width = have[0];
  const height = Math.round(width * spec.h / spec.w);

  /* The hero is the largest image above the fold on the busiest page, so it is
     the one worth fetching early; everything else waits until it is near the
     viewport. width and height are on the img so the box is reserved before the
     bytes arrive and the page does not jump as each one lands. */
  const eager = cls === 'slot--hero';
  const loading = eager
    ? 'loading="eager" fetchpriority="high"'
    : 'loading="lazy"';

  return `<picture class="photo${cls ? ' photo--' + cls.replace('slot--', '') : ''}">
        <source type="image/webp" srcset="${attr(webp)}" sizes="${attr(spec.sizes)}">
        <img src="${attr(url(width, 'jpg'))}" alt="${attr(photoAlt(key, lang, label))}"
         width="${width}" height="${height}" ${loading} decoding="async"></picture>`;
}

/* Google review QR. The SVG is generated at build time by tools/gen-review-qr.py
   and committed, so the page loads no third-party script. Both the link and the
   file must exist — with no review URL in business.json the block is omitted
   entirely rather than shipping a dead QR. */
function reviewBlock(t, base, where) {
  if (!biz.reviewUrl) return '';
  const qr = fs.existsSync(path.join(ROOT, 'src', 'assets', 'img', 'review-qr.svg'))
    ? `<img class="review__qr" src="${base}assets/img/review-qr.svg" width="132" height="132" loading="lazy" alt="${attr(t.reviewQrAlt)}">`
    : '';
  return `
      <div class="review review--${where}">
        ${qr}
        <div class="review__body">
          <h2 class="review__title">${esc(t.reviewTitle)}</h2>
          <p>${esc(t.reviewBody)}</p>
          <a class="link-more" href="${attr(biz.reviewUrl)}" target="_blank" rel="noopener">${esc(t.reviewCta)} ${ICONS.arrow}</a>
        </div>
      </div>`;
}

/* Rendered empty and hidden. main.js fills it from the opening hours in
   business.json; with JavaScript off it stays hidden rather than asserting a
   state nobody has checked. */
function openBadge(t) {
  /* A <span>, not a <p>: this sits inside the topbar's own <span>, and a
     paragraph is flow content that has no business there. Browsers tolerate the
     nesting, but it is invalid and a validator flags it. */
  return `<span class="openbadge" id="openBadge" hidden
     data-open="${attr(biz.hours.shop.opens)}" data-close="${attr(biz.hours.shop.closes)}"
     data-l-open="${attr(t.openNow)}" data-l-until="${attr(t.openUntil)}"
     data-l-closed="${attr(t.closedNow)}" data-l-opens="${attr(t.closedOpens)}"><span></span></span>`;
}

function header(t, lang, page, base, slug) {
  const up = upFor(page);
  const nav = PAGES.map(id =>
    `<li><a href="${up}${FILE[id]}"${id === page ? ' aria-current="page"' : ''}>${esc(t.nav[id])}</a></li>`
  ).join('');
  const other = lang === 'en' ? 'bn' : 'en';
  // The same page in the other language, from wherever this document sits.
  const otherHref = page === 'trade'
    ? (lang === 'en' ? `../../bn/${TRADE_DIR}/${slug}/` : `../../../${TRADE_DIR}/${slug}/`)
    : (lang === 'en' ? `bn/${FILE[page]}` : `../${FILE[page]}`);
  return `
<div class="topbar">
  <div class="shell topbar__inner">
    <span>${esc(t.topbar)}${openBadge(t)}</span>
    <span class="topbar__delivery">${esc(t.delivery)}</span>
  </div>
</div>

<header class="site-header" id="siteHeader">
  <div class="shell header__inner">
    <a class="brand" href="${up}${FILE.home}">
      ${logoMark(base)}
      <span class="brand__text">
        <strong>ERA <span>SANITARY</span></strong>
        <small>${esc(t.tagline)}</small>
      </span>
    </a>

    <button class="nav-toggle" id="navToggle" aria-expanded="false" aria-controls="primaryNav" aria-label="Menu">
      <span></span><span></span><span></span>
    </button>

    <nav class="nav" id="primaryNav" aria-label="Primary">
      <ul class="nav__list">${nav}</ul>
      <div class="nav__aside">
        <p class="langswitch">
          <span class="langswitch__on" aria-current="true">${lang === 'en' ? 'EN' : 'বাং'}</span>
          <a href="${otherHref}" hreflang="${other}" lang="${other}" data-lang-link="${other}">${other === 'en' ? 'EN' : 'বাং'}</a>
        </p>
        <a class="btn btn--accent btn--sm" href="${attr(waLink(t.orderMsg))}" target="_blank" rel="noopener">
          ${ICONS.whatsapp}${esc(t.whatsapp)}
        </a>
      </div>
    </nav>
  </div>
</header>`;
}

const phoneLabel = (p, lang) => (lang === 'bn' && p.displayBn) ? p.displayBn : p.display;

function footer(t, lang, base, page) {
  const up = upFor(page);
  const navLinks = PAGES.map(id => `<li><a href="${up}${FILE[id]}">${esc(t.nav[id])}</a></li>`).join('');
  const phones = biz.phones.map(p =>
    `<li>${ICONS.phone}<a href="tel:${attr(p.tel)}">${esc(phoneLabel(p, lang))}</a></li>`).join('');
  const email = biz.email
    ? `<li>${ICONS.mail}<a href="mailto:${attr(biz.email)}" class="wrap">${esc(biz.email)}</a></li>` : '';
  return `
<footer class="site-footer">
  <div class="shell footer__grid">
    <div class="footer__brand">
      ${/* Deliberately not a link, unlike the header brand.
            Three taps here open the leads dashboard (see main.js), and that
            cannot work inside an <a>: the first tap would navigate and the
            count would never reach three. preventDefault() is not the answer
            either — it would break the link for a keyboard user pressing Enter
            and for anyone who taps the logo once meaning to go home.
            Nothing is lost: the Pages column two columns over already links
            home, so this was a second route to the same place. */''}
      <span class="brand footer__mark" data-admin="${attr(base)}admin/">
        ${logoMark(base)}
        <span class="brand__text"><strong>ERA <span>SANITARY</span></strong><small>${esc(t.tagline)}</small></span>
      </span>
      <p>${esc(t.footerBlurb)}</p>
    </div>
    <nav class="footer__col" aria-label="${attr(t.footerPages)}">
      <h2>${esc(t.footerPages)}</h2>
      <ul>${navLinks}</ul>
    </nav>
    <div class="footer__col">
      <h2>${esc(t.footerReach)}</h2>
      <ul class="footer__contact">
        <li>${ICONS.pin}<a href="${attr(mapsUrl)}" target="_blank" rel="noopener">${esc(t.address)}</a></li>
        ${phones}
        ${email}
      </ul>
${reviewBlock(t, base, 'footer')}
    </div>
  </div>
  <div class="shell footer__legal">
    <p>&copy; <span data-year>${new Date().getFullYear()}</span> ${esc(biz.name)}.</p>
    <p>${esc(t.footerHours)}</p>
  </div>
</footer>`;
}

/* ------------------------------------------------------------------ pages */
function homePage(t, lang, base) {
  const facts = t.heroFacts.map(f =>
    `<li><strong>${esc(f.value)}</strong><span>${esc(f.label)}</span></li>`).join('');

  const pillars = t.pillars.map(p => `
      <article class="pillar">
        <p class="pillar__n">${esc(p.n)}</p>
        <h3>${esc(p.title)}</h3>
        <p>${esc(p.body)}</p>
      </article>`).join('');

  const cards = t.categories.map(c => `
      <a class="cat-card" href="products.html#${attr(c.slug)}">
        ${photo('cat-' + c.slug, 'card', lang, base, c.title, 'slot--card')}
        <div class="cat-card__body">
          <p class="cat-card__size">${esc(c.size)}</p>
          <h3>${esc(c.title)}</h3>
          <p>${esc(c.blurb)}</p>
          <span class="link-more">${esc(t.seeAll)} ${ICONS.arrow}</span>
        </div>
      </a>`).join('');

  const reasons = t.reasons.map(r => `
        <li>${ICONS.check}<div><h3>${esc(r.title)}</h3><p>${esc(r.body)}</p></div></li>`).join('');

  const areas = t.areas.concat(t.areas)
    .map((a, i) => `<li${i >= t.areas.length ? ' aria-hidden="true"' : ''}>${esc(a)}</li>`).join('');

  return `
<section class="hero">
  <div class="shell hero__grid">
    <div class="hero__copy">
      <p class="badge">${ICONS.store}${esc(t.heroBadge)}</p>
      <h1>${esc(t.heroA)} <span class="amber">${esc(t.heroB)}</span></h1>
      <p class="lede">${esc(t.heroBody)}</p>
      <div class="hero__actions">
        <a class="btn btn--accent" href="${attr(waLink(t.orderMsg))}" target="_blank" rel="noopener">${ICONS.whatsapp}${esc(t.ctaOrder)}</a>
        <a class="btn btn--ghost" href="contact.html">${esc(t.ctaQuote)} ${ICONS.arrow}</a>
      </div>
      <ul class="facts">${facts}</ul>
    </div>
    <div class="hero__media">
      ${photo('stock', 'hero', lang, base, t.nav.products + ' — ' + t.supplyTitle, 'slot--hero')}
    </div>
  </div>
</section>

<section class="section pillars-band">
  <div class="shell pillars">${pillars}</div>
</section>

<section class="section" id="supply">
  <div class="shell">
    <header class="section-head">
      <h2>${esc(t.supplyTitle)}</h2>
      <a class="link-more" href="products.html">${esc(t.seeAll)} ${ICONS.arrow}</a>
    </header>
    <div class="cat-grid">${cards}</div>
  </div>
</section>

<section class="section why">
  <div class="shell why__grid">
    <div>
      <h2>${esc(t.whyTitle)}</h2>
      <ul class="reasons">${reasons}</ul>
    </div>
    ${photo('counter', 'wide', lang, base, t.whyTitle, 'slot--why')}
  </div>
</section>

<section class="areas">
  <div class="shell"><h2 class="areas__title">${esc(t.areasTitle)}</h2></div>
  <div class="marquee" data-marquee><ul class="marquee__track">${areas}</ul></div>
</section>

<section class="section svc-strip">
  <div class="shell">
    <header class="section-head">
      <h2>${ICONS.tools}${esc(t.servicesTitle)}</h2>
      <a class="link-more" href="services.html">${esc(t.servicesAll)} ${ICONS.arrow}</a>
    </header>
    <p class="lede">${esc(t.servicesIntro)}</p>
    <ul class="chips chips--svc">${t.services.map(sv => `<li>${esc(sv.title)}</li>`).join('')}</ul>
  </div>
</section>
${reviewsSection(t, lang)}
<section class="band">
  <div class="shell band__inner">
    <div>
      <h2>${esc(t.bandTitle)}</h2>
      <p>${esc(t.bandBody)} ${esc(t.bandDelivery)} ${esc(t.areas.join(', '))}${lang === 'bn' ? '।' : '.'}</p>
    </div>
    <div class="band__actions">
      <a class="btn btn--accent" href="${attr(waLink(t.orderMsg))}" target="_blank" rel="noopener">${ICONS.whatsapp}${esc(t.bandWa)}</a>
      <a class="btn btn--ghost" href="tel:${attr(primary.tel)}">${ICONS.phone}${esc(t.bandCall)}</a>
    </div>
  </div>
</section>`;
}

function productsPage(t, lang, base) {
  const blocks = t.categories.map((c, i) => `
    <article class="cat" id="${attr(c.slug)}">
      ${photo('cat-' + c.slug, 'sq43', lang, base, c.title, 'slot--cat')}
      <div class="cat__body">
        <p class="cat__n"><span>${String(i + 1).padStart(2, '0')}</span> ${esc(c.size)}</p>
        <h2>${esc(c.title)}</h2>
        <p class="cat__long">${esc(c.long)}</p>
        <ul class="chips">${c.items.map(it => `<li${ETC.has(it) ? ' class="is-etc"' : ''}>${esc(it)}</li>`).join('')}</ul>
      </div>
    </article>`).join('');

  return `
<section class="section page-head">
  <div class="shell">
    <h1>${esc(t.supplyTitle)}</h1>
    <p class="lede">${esc(t.productsIntro)}</p>
  </div>
</section>

<div class="shell cats">${blocks}</div>

<section class="band">
  <div class="shell band__inner">
    <div>
      <h2>${esc(t.notListed)}</h2>
      <p>${esc(t.notListedBody)}</p>
    </div>
    <div class="band__actions">
      <a class="btn btn--accent" href="${attr(waLink(t.orderMsg))}" target="_blank" rel="noopener">${ICONS.whatsapp}${esc(t.bandWa)}</a>
      <a class="btn btn--ghost" href="contact.html">${esc(t.ctaQuote)} ${ICONS.arrow}</a>
    </div>
  </div>
</section>`;
}

function servicesPage(t, lang, base) {
  // Everything ERA offers, supply first then the trades they carry out.
  const supply = t.categories.map(c => `
      <a class="cat-card" href="products.html#${attr(c.slug)}">
        ${photo('cat-' + c.slug, 'card', lang, base, c.title, 'slot--card')}
        <div class="cat-card__body">
          <p class="cat-card__size">${esc(c.size)}</p>
          <h3>${esc(c.title)}</h3>
          <p>${esc(c.blurb)}</p>
          <span class="link-more">${esc(t.seeAll)} ${ICONS.arrow}</span>
        </div>
      </a>`).join('');

  const works = t.services.map((sv, i) => `
      <article class="svc" id="${attr(sv.slug)}">
        <a class="svc__link" href="${TRADE_DIR}/${attr(sv.slug)}/">
          ${photo('trade-' + sv.slug, 'sq43', lang, base, sv.title, 'slot--svc')}
          <div class="svc__body">
            <p class="svc__n">${String(i + 1).padStart(2, '0')}</p>
            <h3>${esc(sv.title)}</h3>
            <p>${esc(sv.blurb)}</p>
            <span class="link-more">${esc(t.seeAll)} ${ICONS.arrow}</span>
          </div>
        </a>
      </article>`).join('');

  return `
<section class="section page-head">
  <div class="shell">
    <h1>${esc(t.servicesTitle)}</h1>
    <p class="lede">${esc(t.servicesIntro)}</p>
  </div>
</section>

<section class="section">
  <div class="shell">
    <header class="section-head">
      <h2>${esc(t.supplyTitle)}</h2>
      <a class="link-more" href="products.html">${esc(t.seeAll)} ${ICONS.arrow}</a>
    </header>
    <div class="cat-grid">${supply}</div>
  </div>
</section>

<section class="section works">
  <div class="shell">
    <header class="section-head">
      <h2>${ICONS.tools}${esc(t.worksTitle)}</h2>
    </header>
    <p class="lede">${esc(t.worksIntro)}</p>
    <div class="svc-grid">${works}</div>
  </div>
</section>

<section class="band">
  <div class="shell band__inner">
    <div>
      <h2>${esc(t.bandTitle)}</h2>
      <p>${esc(t.bandBody)}</p>
    </div>
    <div class="band__actions">
      <a class="btn btn--accent" href="${attr(waLink(t.orderMsg))}" target="_blank" rel="noopener">${ICONS.whatsapp}${esc(t.bandWa)}</a>
      <a class="btn btn--ghost" href="contact.html">${esc(t.ctaQuote)} ${ICONS.arrow}</a>
    </div>
  </div>
</section>`;
}

/* One page per trade. Everything on it comes from content already in the repo —
   the trade's own title and blurb, the delivery areas, the other trades. Nothing
   about price, experience or guarantees is asserted, because nothing in the
   repo says any of it. */
function tradePage(t, lang, base, slug) {
  const i = t.services.findIndex(sv => sv.slug === slug);
  const sv = t.services[i];
  const areas = t.areas.map(a => `<li>${esc(a)}</li>`).join('');
  const others = t.services
    .filter(o => o.slug !== slug)
    .map(o => `<li><a href="../${attr(o.slug)}/">${esc(o.title)} ${ICONS.arrow}</a></li>`).join('');

  return `
<section class="section page-head">
  <div class="shell">
    <p class="crumb"><a href="../../services.html">${esc(t.servicesTitle)}</a></p>
    <h1>${esc(sv.title)}</h1>
    <p class="lede">${esc(sv.blurb)}</p>
    <div class="hero__actions">
      <a class="btn btn--accent" href="../../contact.html?for=${attr(slug)}">${esc(t.tradeQuoteCta)} ${ICONS.arrow}</a>
      <a class="btn btn--ghost" href="${attr(waLink(t.orderMsg))}" target="_blank" rel="noopener">${ICONS.whatsapp}${esc(t.whatsapp)}</a>
    </div>
  </div>
</section>

<div class="shell trade__grid">
  ${photo('trade-' + slug, 'trade', lang, base, sv.title, 'slot--trade')}
  <div class="trade__side">
    <h2>${ICONS.pin}${esc(t.tradeAreasTitle)}</h2>
    <ul class="chips">${areas}</ul>
  </div>
</div>

<section class="section works">
  <div class="shell">
    <header class="section-head">
      <h2>${ICONS.tools}${esc(t.tradeOtherTitle)}</h2>
      <a class="link-more" href="../../services.html">${esc(t.tradeBackToAll)} ${ICONS.arrow}</a>
    </header>
    <ul class="trade__others">${others}</ul>
  </div>
</section>

<section class="band">
  <div class="shell band__inner">
    <div>
      <h2>${esc(t.bandTitle)}</h2>
      <p>${esc(t.bandBody)}</p>
    </div>
    <div class="band__actions">
      <a class="btn btn--accent" href="${attr(waLink(t.orderMsg))}" target="_blank" rel="noopener">${ICONS.whatsapp}${esc(t.bandWa)}</a>
      <a class="btn btn--ghost" href="../../contact.html?for=${attr(slug)}">${esc(t.ctaQuote)} ${ICONS.arrow}</a>
    </div>
  </div>
</section>`;
}

function aboutPage(t, lang, base) {
  const stats = t.stats.map(s =>
    `<li><strong>${esc(s.value)}</strong><span>${esc(s.label)}</span></li>`).join('');
  const amenities = t.amenities.map(a => `<li>${ICONS.check}${esc(a)}</li>`).join('');
  const payments = t.payments.map(p => `<li>${esc(p)}</li>`).join('');

  return `
<section class="section page-head">
  <div class="shell">
    <h1>${esc(t.aboutTitle)}</h1>
  </div>
</section>

<section class="shell about__grid">
  <div class="about__copy">
    <p class="lede">${esc(t.aboutP1)}</p>
    <p>${esc(t.aboutP2)}</p>
    <p>${esc(t.aboutP3)}</p>
  </div>
  ${photo('shopfront', 'wide', lang, base, t.aboutTitle, 'slot--about')}
</section>

<section class="section">
  <div class="shell">
    <ul class="stats">${stats}</ul>
  </div>
</section>

<section class="section">
  <div class="shell two-col">
    <div>
      <h2>${ICONS.store}${esc(t.amenitiesTitle)}</h2>
      <ul class="ticks">${amenities}</ul>
    </div>
    <div>
      <h2>${ICONS.card}${esc(t.paymentsTitle)}</h2>
      <ul class="chips">${payments}</ul>
    </div>
  </div>
</section>
${biz.reviewUrl ? `
<section class="section review-band">
  <div class="shell">${reviewBlock(t, base, 'page')}</div>
</section>` : ''}`;
}

function contactPage(t, lang) {
  // Both numbers are on WhatsApp, so each gets its own call and chat action.
  const phones = biz.phones.map(p => `
        <li>
          ${ICONS.phone}<a href="tel:${attr(p.tel)}">${esc(phoneLabel(p, lang))}</a>
          <a class="chat-link" href="${attr(waLink(t.orderMsg, p))}" target="_blank" rel="noopener"
             aria-label="${attr(t.whatsapp + ' ' + p.display)}">${ICONS.whatsapp}${esc(t.whatsapp)}</a>
        </li>`).join('');
  const email = biz.email ? `
    <h2 class="card__label">${esc(t.emailLabel)}</h2>
    <ul class="card__list card__list--email">
      <li>${ICONS.mail}<a href="mailto:${attr(biz.email)}">${esc(biz.email)}</a></li>
    </ul>` : '';
  const hours = t.hours.map(h => `
        <tr><th scope="row">${esc(h.label)}</th><td>${esc(h.value)}</td></tr>`).join('');
  /* Supply and trades in one control, grouped so the list stays readable. The
     data-slug lets a trade page preselect its own trade without matching on
     translated text. Order and default selection are unchanged, so a visitor
     who touches nothing still composes exactly the message they did before. */
  const options =
    `<optgroup label="${attr(t.supplyTitle)}">`
    + t.categories.map(c => `<option data-slug="${attr(c.slug)}">${esc(c.title)}</option>`).join('')
    + `</optgroup><optgroup label="${attr(t.worksTitle)}">`
    + t.services.map(sv => `<option data-slug="${attr(sv.slug)}">${esc(sv.title)}</option>`).join('')
    + `</optgroup><option>${esc(t.somethingElse)}</option>`;

  return `
<section class="section page-head">
  <div class="shell">
    <h1>${esc(t.contactTitle)}</h1>
  </div>
</section>

<div class="shell contact__grid">
  <div class="card">
    <h2 class="card__label">${esc(t.storeLabel)}</h2>
    <p class="card__addr">${esc(t.address)}</p>
    <a class="link-more" href="${attr(directionsUrl)}" target="_blank" rel="noopener">${esc(t.directions)}</a>

    <h2 class="card__label">${esc(t.callLabel)}</h2>
    <ul class="card__list">${phones}</ul>
${email}
    <p class="muted">${ICONS.clock}${esc(t.replies)}</p>
  </div>

  <div class="card">
    <h2 class="card__label">${esc(t.hoursTitle)}</h2>
    <table class="hours"><tbody>${hours}</tbody></table>
    <p class="muted">${esc(t.hoursNote)}</p>
  </div>

  <div class="card card--form">
    <h2>${esc(t.formTitle)}</h2>
    <p class="muted">${esc(t.formBody)}</p>
    <form id="quoteForm" data-wa="${attr(primary.whatsapp)}"${fbAttrs()} novalidate>
      <p class="hp" aria-hidden="true"><label for="qCompany">Company</label><input id="qCompany" name="company" type="text" tabindex="-1" autocomplete="off"></p>
      <p class="field">
        <label for="qName">${esc(t.fName)}</label>
        <input id="qName" name="name" type="text" autocomplete="name" placeholder="${attr(t.phName)}">
      </p>
      <p class="field">
        <label for="qPhone">${esc(t.fPhone)}</label>
        <input id="qPhone" name="phone" type="tel" autocomplete="tel" inputmode="tel">
      </p>
      <p class="field">
        <label for="qCat">${esc(t.fNeed)}</label>
        <select id="qCat" name="category">${options}</select>
      </p>
      <p class="field">
        <label for="qList">${esc(t.fList)}</label>
        <textarea id="qList" name="items" rows="4" placeholder="${attr(t.phList)}"></textarea>
      </p>
      <button class="btn btn--accent btn--block" type="submit">${ICONS.whatsapp}${esc(t.formSend)}</button>
      <p class="muted">${esc(t.formFoot)}</p>
    </form>
    <script type="application/json" id="quoteStrings">${JSON.stringify({
      hello: t.msgHello, name: t.msgName, phone: t.msgPhone,
      cat: t.msgCat, items: t.msgItems, close: t.msgClose, err: t.formErr
    })}</script>
  </div>
</div>`;
}

/* ----------------------------------------------------------------- layout */
const META = {
  en: {
    home:     { title: `${biz.name} — Pipes, Fittings & Sanitary Ware in Rampura, Dhaka`,
                desc: 'Retail and wholesale supplier of C-PVC, U-PVC and pressure PVC-U pipe systems, bathroom fittings, ceramics and kitchen items. Rampura, Dhaka since 2003. Open 7 days, delivery across Dhaka.' },
    products: { title: `What We Supply — ${biz.shortName}`,
                desc: 'C-PVC, U-PVC and pressure PVC-U pipes and fittings, bathroom fittings, plumbing hardware, sanitary ceramics and kitchen items — stocked for retail and wholesale in Rampura, Dhaka.' },
    services: { title: `Our Services — Plumbing, Tiling, Waterproofing & Civil Work | ${biz.shortName}`,
                desc: 'Plumbing and sanitary work, tiles, marble and granite, core cutting, deep tube well, swimming pool, damp and water proofing, electrical, painting and civil work in Rampura, Dhaka.' },
    about:    { title: `About Us — ${biz.shortName}`,
                desc: 'Supplying sanitary and plumbing materials from Rampura, Dhaka since 2003. Retail and wholesale on one counter, open every day 07:00–22:00.' },
    contact:  { title: `Contact & Quote — ${biz.shortName}`,
                desc: 'Send your item list on WhatsApp and we quote it the same day. 5/1 West Hazipara, D.I.T Road, Rampura, Dhaka-1219. Call 01711-954094 or 01611-954094.' },
  },
  bn: {
    home:     { title: `${biz.name} — রামপুরা, ঢাকা | পাইপ, ফিটিংস ও স্যানিটারি সামগ্রী`,
                desc: 'সি-পিভিসি, ইউ-পিভিসি ও প্রেশার পিভিসি-ইউ পাইপ-ফিটিংস, বাথরুম ফিটিংস, সিরামিক ও কিচেন সামগ্রীর খুচরা ও পাইকারি সরবরাহকারী। ২০০৩ সাল থেকে রামপুরা, ঢাকা। সপ্তাহে ৭ দিন খোলা।' },
    products: { title: `আমরা যা সরবরাহ করি — ${biz.shortName}`,
                desc: 'সি-পিভিসি, ইউ-পিভিসি ও প্রেশার পিভিসি-ইউ পাইপ ও ফিটিংস, বাথরুম ফিটিংস, প্লাম্বিং হার্ডওয়্যার, সিরামিক ও কিচেন সামগ্রী — রামপুরা, ঢাকায় খুচরা ও পাইকারি।' },
    services: { title: `আমাদের সেবাসমূহ — প্লাম্বিং, টাইলস, ওয়াটার প্রুফিং ও সিভিল কাজ | ${biz.shortName}`,
                desc: 'রামপুরা, ঢাকায় প্লাম্বিং ও স্যানিটারি কাজ, টাইলস, মার্বেল ও গ্রানাইট, কোর কাটিং, ডিপ টিউবওয়েল, সুইমিং পুল, ড্যাম্প ও ওয়াটার প্রুফিং, ইলেকট্রিক, পেইন্টিং এবং সিভিল কাজ।' },
    about:    { title: `আমাদের সম্পর্কে — ${biz.shortName}`,
                desc: '২০০৩ সাল থেকে রামপুরা, ঢাকা থেকে স্যানিটারি ও প্লাম্বিং সামগ্রী সরবরাহ। এক দোকানেই খুচরা ও পাইকারি, প্রতিদিন খোলা ৭:০০ – ২২:০০।' },
    contact:  { title: `যোগাযোগ ও দাম — ${biz.shortName}`,
                desc: 'হোয়াটসঅ্যাপে মালের তালিকা পাঠান, একই দিনে দাম জানিয়ে দেব। ৫/১ পশ্চিম হাজীপাড়া, ডি.আই.টি রোড, রামপুরা, ঢাকা-১২১৯। কল ০১৭১১-৯৫৪০৯৪।' },
  },
};

function urlFor(lang, page, slug) {
  const p = lang === 'en' ? '' : 'bn/';
  if (page === 'trade') return `${SITE}/${p}${TRADE_DIR}/${slug}/`;
  return SITE + '/' + p + (page === 'home' ? '' : FILE[page]);
}

/* A trade page's title and description, built from the trade's own words plus
   the address already in business.json. Nothing here is invented. */
function tradeMeta(lang, slug) {
  const t = copy[lang];
  const sv = t.services.find(x => x.slug === slug);
  const where = lang === 'bn'
    ? `${biz.address.locality}, ${biz.address.region}`
    : `${biz.address.locality}, ${biz.address.region}`;
  return {
    title: `${sv.title} ${t.tradeInDhaka} | ${biz.shortName}`,
    desc: `${sv.blurb} ${sv.title} ${t.tradeInDhaka} — ${where}. ${t.worksIntro}`,
  };
}

function jsonLd(t, lang) {
  const h = biz.hours.shop;
  return {
    '@context': 'https://schema.org',
    '@type': ['HardwareStore', 'GeneralContractor'],
    '@id': SITE + '/#store',
    name: biz.name,
    alternateName: lang === 'bn' ? 'ইরা স্যানিটারি অ্যান্ড প্লাম্বিং সলিউশনস' : biz.shortName,
    description: META[lang].home.desc,
    slogan: t.tagline,
    url: SITE + '/',
    foundingDate: biz.sinceISO,
    logo: SITE + '/' + biz.images.logo,
    image: SITE + '/' + biz.images.banner,
    telephone: primary.tel,
    ...(biz.email ? { email: biz.email } : {}),
    address: {
      '@type': 'PostalAddress',
      streetAddress: biz.address.street,
      addressLocality: `${biz.address.locality}, ${biz.address.region}`,
      postalCode: biz.address.postalCode,
      addressCountry: biz.address.country,
    },
    ...(biz.maps ? {
      geo: { '@type': 'GeoCoordinates', latitude: biz.maps.lat, longitude: biz.maps.lng },
      hasMap: biz.maps.placeUrl,
    } : {}),
    contactPoint: biz.phones.map(p => ({
      '@type': 'ContactPoint', telephone: p.tel, contactType: 'sales',
      availableLanguage: ['en', 'bn'],
    })),
    openingHoursSpecification: [{
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      opens: h.opens, closes: h.closes,
    }],
    areaServed: copy.en.areas.map(a => ({ '@type': 'Place', name: a })),
    paymentAccepted: biz.payments.join(', '),
    makesOffer: t.services.map(sv => ({
      '@type': 'Offer',
      itemOffered: {
        '@type': 'Service',
        name: sv.title,
        description: sv.blurb,
        url: urlFor(lang, 'trade', sv.slug),
        areaServed: copy.en.areas.map(a => ({ '@type': 'Place', name: a })),
        provider: { '@id': SITE + '/#store' },
      },
    })),
    hasOfferCatalog: {
      '@type': 'OfferCatalog',
      name: t.supplyTitle,
      itemListElement: t.categories.map(c => ({
        '@type': 'OfferCatalog', name: c.title,
        itemListElement: c.items.map(i => ({
          '@type': 'Offer', itemOffered: { '@type': 'Product', name: i },
        })),
      })),
    },
  };
}

/* The leads dashboard. Its own page, its own layout — it shares nothing with the
   public site except the colour tokens, because it is a tool for one person
   rather than a page that has to persuade anyone.

   This is the ONE page allowed to load a third-party script. Firebase Auth
   cannot be done over REST without minting and refreshing tokens by hand, and
   the reason RULES.md bans third-party scripts — a stalled CDN blocking the
   site's own JavaScript for a customer on mobile data — does not apply to a
   signed-in owner opening their own back office on purpose. Nothing here reaches
   any public page: the import lives in this string and nowhere else.

   noindex, Disallow and omission from the sitemap keep it out of search results.
   None of those is a security boundary. The boundary is Firebase Auth plus the
   Firestore rules, which is why this page being publicly reachable is fine. */
function adminPage() {
  const cfg = fb();
  const wc = cfg.webConfig || {};
  const configured = !!(wc.apiKey && wc.authDomain && cfg.projectId);

  const setup = `
    <div class="box">
      <h2>Not connected yet</h2>
      <p>Open <strong>Firebase Console → Project settings → Your apps</strong> and add a
         Web app if there is not one. Copy <code>apiKey</code>, <code>authDomain</code>
         and <code>appId</code> into <code>content/business.json</code> under
         <code>firebase.webConfig</code>, then rebuild and push.</p>
      <p class="muted">These keys are public by design. They name the project; they do
         not grant access to it. The Firestore rules decide that.</p>
    </div>`;

  const app = `
    <p class="err" id="bootErr" hidden></p>

    <form id="signin" class="box" hidden>
      <h2>Sign in</h2>
      <label for="email">Email</label>
      <input id="email" type="email" autocomplete="username" required>
      <label for="pass">Password</label>
      <input id="pass" type="password" autocomplete="current-password" required>
      <button class="btn" type="submit">Sign in</button>
      <p class="err" id="signinErr" hidden></p>
    </form>

    <div id="app" hidden>
      <div class="bar">
        <div class="counts" id="counts"></div>
        <input id="search" type="search" placeholder="Search name, phone or items" aria-label="Search leads">
        <button class="btn btn--ghost" id="signout" type="button">Sign out</button>
      </div>
      <p class="err" id="appErr" hidden></p>
      <div id="list" class="list" aria-live="polite"></div>
    </div>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Leads — ${esc(biz.name)}</title>
<meta name="theme-color" content="#0b0b0d">
<link rel="icon" href="../assets/img/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="../assets/css/admin.css">
</head>
<body>
<header class="top">
  <img src="../assets/img/era-logo.png" alt="" width="34" height="34">
  <strong>Leads</strong>
  <span class="muted">${esc(biz.name)}</span>
</header>
<main class="wrap">
${configured ? app : setup}
</main>
${configured ? `<script type="module">
const CFG = ${JSON.stringify({ ...wc, projectId: cfg.projectId })};
const OWNERS = ${JSON.stringify(cfg.ownerUids || [])};
const COLL = ${JSON.stringify(cfg.leadsCollection || 'leads')};
const WA = ${JSON.stringify((biz.phones.find(p => p.primary) || biz.phones[0]).whatsapp)};
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
    const wa = tel.replace(/^\\+/, '');
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
</script>` : ''}
</body>
</html>
`;
}

function layout({ lang, page, body, t, slug, base }) {
  const meta = page === 'trade' ? tradeMeta(lang, slug) : META[lang][page];
  const alt = lang === 'en' ? 'bn' : 'en';
  const fonts = 'https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Barlow:wght@400;500;600;700&family=Hind+Siliguri:wght@400;500;600;700&display=swap';

  return `<!doctype html>
<html lang="${lang}"${lang === 'bn' ? ' dir="ltr"' : ''}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(meta.title)}</title>
<meta name="description" content="${attr(meta.desc)}">
<meta name="theme-color" content="#0b0b0d">
<link rel="canonical" href="${attr(urlFor(lang, page, slug))}">
<link rel="alternate" hreflang="${lang}" href="${attr(urlFor(lang, page, slug))}">
<link rel="alternate" hreflang="${alt}" href="${attr(urlFor(alt, page, slug))}">
<link rel="alternate" hreflang="x-default" href="${attr(urlFor('en', page, slug))}">

<meta property="og:type" content="website">
<meta property="og:locale" content="${lang === 'bn' ? 'bn_BD' : 'en_US'}">
<meta property="og:site_name" content="${attr(biz.name)}">
<meta property="og:title" content="${attr(meta.title)}">
<meta property="og:description" content="${attr(meta.desc)}">
<meta property="og:url" content="${attr(urlFor(lang, page, slug))}">
<meta property="og:image" content="${attr(SITE + '/' + biz.images.banner)}">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="${base}assets/img/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${base}assets/img/era-logo-180.png">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${attr(fonts)}">
<link rel="stylesheet" href="${base}assets/css/styles.css">
</head>
<body data-lang="${lang}" data-page="${page}">
<a class="skip-link" href="#main">${lang === 'bn' ? 'মূল কনটেন্টে যান' : 'Skip to main content'}</a>
${header(t, lang, page, base, slug)}
<main id="main">
${body}
</main>
${footer(t, lang, base, page)}
<script type="application/ld+json">${JSON.stringify(jsonLd(t, lang))}</script>
<script src="${base}assets/js/main.js" defer></script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------- main */
const RENDER = { home: homePage, products: productsPage, services: servicesPage, about: aboutPage, contact: contactPage, trade: tradePage };

/* photos.json is keyed by slot, and those keys are built from the slugs in
   copy.json. Rename a slug there and the entry here is orphaned: the photo goes
   on shipping, but with the wrong alt text or no longer cropped where it was
   told to be — silently, and on a page nobody thinks to re-check. The street
   address drifted exactly this way once and reached the footer. Refuse instead. */
function checkPhotos() {
  const known = new Set(['shopfront', 'counter', 'stock']);
  for (const c of copy.en.categories) known.add('cat-' + c.slug);
  for (const sv of copy.en.services) known.add('trade-' + sv.slug);

  for (const [key, entry] of Object.entries(photos)) {
    if (key.startsWith('_')) continue;          // _readme and friends
    if (!known.has(key)) {
      throw new Error(`content/photos.json has "${key}", which is not a photo ` +
        `slot on this site. Expected one of: ${[...known].join(', ')}.`);
    }
    const focus = (entry || {}).focus;
    if (focus !== undefined && !(Array.isArray(focus) && focus.length === 2 &&
        focus.every(n => typeof n === 'number' && n >= 0 && n <= 1))) {
      throw new Error(`content/photos.json: "${key}".focus must be two numbers ` +
        `between 0 and 1, like [0.5, 0.3].`);
    }
  }

  /* A file whose name matches no slot is one the site will never load — almost
     always a slug renamed with the photos left behind. Not fatal: it costs
     nothing but the disk it sits on, and failing the build over it would block
     a deploy for a stale file. */
  if (fs.existsSync(PHOTO_DIR)) {
    const orphans = fs.readdirSync(PHOTO_DIR).filter(f => {
      const m = f.match(/^(.+)-([a-z0-9]+)-(\d+)\.(webp|jpg)$/);
      return !m || !known.has(m[1]) || !RENDITIONS[m[2]];
    });
    if (orphans.length) {
      console.warn(`NOTE: ${orphans.length} file(s) in src/assets/img/photos/ ` +
        `match no slot and are never loaded: ${orphans.slice(0, 4).join(', ')}` +
        `${orphans.length > 4 ? ', …' : ''}`);
    }
  }
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

/* The hero and the About stats both state how many areas ERA delivers to, and
   the areas themselves are listed by name a few sections further down. Those two
   drifted apart: the list grew to fourteen while both counts still read "12+",
   so the site undersold its own coverage on every page. Adding an area is
   exactly when this is easiest to forget, so the build refuses instead.

   The count is compared after folding Bengali digits to ASCII, because the
   Bengali page states it as ১৪ and both are the same claim. */
/* Two lists of the same thing, which is the shape of every content bug this file
   already guards against. business.firebase.ownerUids decides what the dashboard
   draws; isOwner() in firestore.rules decides what Firestore actually allows.
   Let them drift and you get either a dashboard that renders for an account the
   server will refuse, or — worse — one that hides the leads from the person who
   is allowed to read them, with no error to explain it.

   firestore.rules is the source of truth here, because it is the one that
   protects the data. This only checks that the copy agrees. */
function checkFirebaseUids() {
  const rulesPath = path.join(ROOT, 'firestore.rules');
  if (!fs.existsSync(rulesPath)) return;

  const src = fs.readFileSync(rulesPath, 'utf8');
  const block = src.match(/function isOwner\(\)[\s\S]*?\n {4}\}/);
  if (!block) {
    throw new Error('firestore.rules: could not find isOwner() — has the file been ' +
      'restructured? The dashboard\'s UID list is checked against it.');
  }
  /* Quoted strings inside the function body, minus anything commented out. */
  const inRules = (block[0].split('\n')
    .filter(l => !l.trim().startsWith('//'))
    .join('\n').match(/'([^']+)'/g) || []).map(s => s.slice(1, -1));

  const inJson = fb().ownerUids || [];
  const same = inRules.length === inJson.length && inRules.every(u => inJson.includes(u));
  if (!same) {
    throw new Error('content mismatch: business.firebase.ownerUids is ' +
      `[${inJson.join(', ')}] but firestore.rules isOwner() allows ` +
      `[${inRules.join(', ')}]. The rules are the source of truth — make the JSON match.`);
  }
}

function checkAreaCount() {
  for (const lang of ['en', 'bn']) {
    const t = copy[lang];
    const want = String(t.areas.length);
    for (const key of ['heroFacts', 'stats']) {
      const values = t[key].map(f => toAsciiDigits(f.value));
      if (!values.includes(want)) {
        throw new Error(`content mismatch: copy.${lang}.areas lists ${want} areas, ` +
          `but no value in copy.${lang}.${key} says ${want} (found ${values.join(', ')}). ` +
          `Update the count in both languages when the area list changes.`);
      }
    }
  }
}

/* reviews.json is typed by hand, so it is the file most likely to carry a
   slip — a four-star review entered as 4.5, a date as 20-09-2026, a name left
   blank after a paste. Each of those renders as a visibly broken card on a page
   whose whole job is to look trustworthy, so the build stops instead. */
function checkReviews() {
  const at = (i, msg) => `content/reviews.json: items[${i}] ${msg}`;

  if (reviews.rating != null &&
      (typeof reviews.rating !== 'number' || reviews.rating < 0 || reviews.rating > 5)) {
    throw new Error('content/reviews.json: "rating" must be a number from 0 to 5, ' +
      'or null until you have one.');
  }
  if (reviews.count != null &&
      (!Number.isInteger(reviews.count) || reviews.count < reviews.items.length)) {
    throw new Error('content/reviews.json: "count" must be a whole number and at least ' +
      `${reviews.items.length}, the number of reviews listed below it.`);
  }

  reviews.items.forEach((r, i) => {
    if (!r || typeof r.author !== 'string' || !r.author.trim()) {
      throw new Error(at(i, 'has no "author" — use the name as Google shows it.'));
    }
    if (!Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5) {
      throw new Error(at(i, `has rating ${JSON.stringify(r.rating)} — it must be a whole number from 1 to 5.`));
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.date)) || Number.isNaN(Date.parse(r.date))) {
      throw new Error(at(i, `has date ${JSON.stringify(r.date)} — it must be YYYY-MM-DD, like "2026-09-20".`));
    }
    if (typeof r.text !== 'string' || !r.text.trim()) {
      throw new Error(at(i, 'has no "text" — paste what the customer wrote, unedited.'));
    }
  });
}

function build() {
  // The street appears in business.json (schema) and again in copy.json's
  // display strings, which must also carry it in Bengali. Catch drift here:
  // they silently disagreed once and the footer shipped the old address.
  for (const key of ['address', 'footerBlurb']) {
    if (!copy.en[key].includes(biz.address.street)) {
      throw new Error(`content mismatch: business.json street "${biz.address.street}" ` +
        `is not in copy.en.${key} — update both, and the Bengali alongside it.`);
    }
  }
  checkAreaCount();
  checkReviews();
  checkPhotos();
  checkFirebaseUids();

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  copyDir(path.join(ROOT, 'src', 'assets'), path.join(OUT, 'assets'));

  let count = 0, trades = 0;
  for (const lang of ['en', 'bn']) {
    const t = copy[lang];
    const base = lang === 'en' ? '' : '../';
    const dir = lang === 'en' ? OUT : path.join(OUT, 'bn');
    fs.mkdirSync(dir, { recursive: true });
    for (const page of PAGES) {
      const body = RENDER[page](t, lang, base);
      fs.writeFileSync(path.join(dir, FILE[page]), layout({ lang, page, body, t, base }));
      count++;
    }

    /* One directory per trade, so the URL is /services/core-cutting/ rather than
       a file. Assets are three levels up in Bengali, two in English. */
    const tradeBase = base + '../../';
    for (const sv of t.services) {
      const tdir = path.join(dir, TRADE_DIR, sv.slug);
      fs.mkdirSync(tdir, { recursive: true });
      const body = RENDER.trade(t, lang, tradeBase, sv.slug);
      fs.writeFileSync(path.join(tdir, 'index.html'),
        layout({ lang, page: 'trade', body, t, slug: sv.slug, base: tradeBase }));
      count++; trades++;
    }
  }

  const urls = ['en', 'bn'].flatMap(lang => [
    ...PAGES.map(page => ({ lang, page })),
    ...copy[lang].services.map(sv => ({ lang, page: 'trade', slug: sv.slug })),
  ]);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(({ lang, page, slug }) => `  <url>
    <loc>${urlFor(lang, page, slug)}</loc>
${['en', 'bn'].map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${urlFor(l, page, slug)}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor('en', page, slug)}"/>
    <changefreq>monthly</changefreq>
    <priority>${page === 'home' ? '1.0' : page === 'trade' ? '0.7' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap);
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

  /* The leads dashboard. Written after the sitemap and deliberately absent from
     it: it is a back office, not a page anyone should find by searching for the
     shop. Keeping it out of Google is not what protects it — Firebase Auth and
     the Firestore rules are — it just should not be a search result. */
  fs.mkdirSync(path.join(OUT, 'admin'), { recursive: true });
  fs.writeFileSync(path.join(OUT, 'admin', 'index.html'), adminPage());
  fs.writeFileSync(path.join(OUT, 'robots.txt'),
    `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${SITE}/sitemap.xml\n`);

  console.log(`Built ${count} pages (${PAGES.length} × en/bn, plus ${trades} trade pages) + sitemap + robots into dist/`);
  console.log(`Site origin: ${SITE}${process.env.SITE_URL ? ' (from SITE_URL)' : ' (from business.json)'}`);
  if (!biz.email) console.log('NOTE: business.email is null — no email is shown anywhere on the site.');
  if (!fb().projectId) console.log('NOTE: business.firebase.projectId is empty — the quote form opens WhatsApp only, nothing is recorded. Create a Firebase project (free, no card) and paste its ID; see README.');
  else if (!(fb().webConfig || {}).apiKey) console.log('NOTE: business.firebase.webConfig is empty — /admin/ shows setup instructions instead of the leads. Firebase Console -> Project settings -> Your apps -> Web app.');
  if (!biz.reviewUrl) console.log('NOTE: business.reviewUrl is empty — the Google review block and QR are omitted from every page.');
}

build();
