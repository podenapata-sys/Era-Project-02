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

/* Absolute URLs (canonical, hreflang, Open Graph, sitemap, robots) need the
   real origin. SITE_URL overrides content/business.json so a Pages or preview
   build advertises itself rather than the production domain. */
const SITE = (process.env.SITE_URL || biz.url).replace(/\/+$/, '');

const PAGES = ['home', 'products', 'about', 'contact'];
const FILE = { home: 'index.html', products: 'products.html', about: 'about.html', contact: 'contact.html' };

const esc = s => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const attr = esc;
const primary = biz.phones.find(p => p.primary) || biz.phones[0];
const addressLine = `${biz.address.street}, ${biz.address.locality}, ${biz.address.region}-${biz.address.postalCode}, ${biz.address.countryName}`;
const mapsUrl = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(`${biz.name}, ${addressLine}`);
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
  mail: icon('<rect x="3" y="5.5" width="18" height="13" rx="2.4" stroke="currentColor" stroke-width="1.7"/><path d="m4 7.5 8 5.5 8-5.5" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/>'),
};

/* ------------------------------------------------------------- components */
function logoMark(base) {
  return `<span class="logo"><img src="${base}${biz.images.logo}" alt="" width="44" height="44" loading="eager" decoding="async"></span>`;
}

function photoSlot(label, cls) {
  // Client photography is pending; these keep the layout honest until it lands.
  return `<div class="slot${cls ? ' ' + cls : ''}" role="img" aria-label="${attr(label)}"><span>${esc(label)}</span></div>`;
}

function header(t, lang, page, base) {
  const nav = PAGES.map(id =>
    `<li><a href="${base === '../' ? '' : ''}${FILE[id]}"${id === page ? ' aria-current="page"' : ''}>${esc(t.nav[id])}</a></li>`
  ).join('');
  const other = lang === 'en' ? 'bn' : 'en';
  const otherHref = lang === 'en' ? `bn/${FILE[page]}` : `../${FILE[page]}`;
  return `
<div class="topbar">
  <div class="shell topbar__inner">
    <span>${esc(t.topbar)}</span>
    <span class="topbar__delivery">${esc(t.delivery)}</span>
  </div>
</div>

<header class="site-header" id="siteHeader">
  <div class="shell header__inner">
    <a class="brand" href="${FILE.home}">
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

function footer(t, lang, base) {
  const navLinks = PAGES.map(id => `<li><a href="${FILE[id]}">${esc(t.nav[id])}</a></li>`).join('');
  const phones = biz.phones.map(p =>
    `<li>${ICONS.phone}<a href="tel:${attr(p.tel)}">${esc(phoneLabel(p, lang))}</a></li>`).join('');
  const email = biz.email
    ? `<li>${ICONS.mail}<a href="mailto:${attr(biz.email)}" class="wrap">${esc(biz.email)}</a></li>` : '';
  return `
<footer class="site-footer">
  <div class="shell footer__grid">
    <div class="footer__brand">
      <a class="brand" href="${FILE.home}">
        ${logoMark(base)}
        <span class="brand__text"><strong>ERA <span>SANITARY</span></strong><small>${esc(t.tagline)}</small></span>
      </a>
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
        ${photoSlot(c.title, 'slot--card')}
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
      ${photoSlot(t.nav.products + ' — ' + t.supplyTitle, 'slot--hero')}
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
    ${photoSlot(t.whyTitle, 'slot--why')}
  </div>
</section>

<section class="areas">
  <div class="shell"><h2 class="areas__title">${esc(t.areasTitle)}</h2></div>
  <div class="marquee" data-marquee><ul class="marquee__track">${areas}</ul></div>
</section>

<section class="band">
  <div class="shell band__inner">
    <div>
      <h2>${esc(t.bandTitle)}</h2>
      <p>${esc(t.bandBody)}</p>
    </div>
    <div class="band__actions">
      <a class="btn btn--accent" href="${attr(waLink(t.orderMsg))}" target="_blank" rel="noopener">${ICONS.whatsapp}${esc(t.bandWa)}</a>
      <a class="btn btn--ghost" href="tel:${attr(primary.tel)}">${ICONS.phone}${esc(t.bandCall)}</a>
    </div>
  </div>
</section>`;
}

function productsPage(t) {
  const blocks = t.categories.map((c, i) => `
    <article class="cat" id="${attr(c.slug)}">
      ${photoSlot(c.title, 'slot--cat')}
      <div class="cat__body">
        <p class="cat__n"><span>${String(i + 1).padStart(2, '0')}</span> ${esc(c.size)}</p>
        <h2>${esc(c.title)}</h2>
        <p class="cat__long">${esc(c.long)}</p>
        <ul class="chips">${c.items.map(it => `<li>${esc(it)}</li>`).join('')}</ul>
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

function aboutPage(t) {
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
  ${photoSlot(t.aboutTitle, 'slot--about')}
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
</section>`;
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
  const options = t.categories.map(c => `<option>${esc(c.title)}</option>`)
    .concat([`<option>${esc(t.somethingElse)}</option>`]).join('');

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
    <a class="link-more" href="${attr(mapsUrl)}" target="_blank" rel="noopener">${esc(t.directions)}</a>

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
    <form id="quoteForm" data-wa="${attr(primary.whatsapp)}" novalidate>
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
    about:    { title: `আমাদের সম্পর্কে — ${biz.shortName}`,
                desc: '২০০৩ সাল থেকে রামপুরা, ঢাকা থেকে স্যানিটারি ও প্লাম্বিং সামগ্রী সরবরাহ। এক দোকানেই খুচরা ও পাইকারি, প্রতিদিন খোলা ৭:০০ – ২২:০০।' },
    contact:  { title: `যোগাযোগ ও দাম — ${biz.shortName}`,
                desc: 'হোয়াটসঅ্যাপে মালের তালিকা পাঠান, একই দিনে দাম জানিয়ে দেব। ৫/১ পশ্চিম হাজীপাড়া, ডি.আই.টি রোড, রামপুরা, ঢাকা-১২১৯। কল ০১৭১১-৯৫৪০৯৪।' },
  },
};

function urlFor(lang, page) {
  const p = lang === 'en' ? '' : 'bn/';
  return SITE + '/' + p + (page === 'home' ? '' : FILE[page]);
}

function jsonLd(t, lang) {
  const h = biz.hours.shop;
  return {
    '@context': 'https://schema.org',
    '@type': 'HardwareStore',
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

function layout({ lang, page, body, t }) {
  const base = lang === 'en' ? '' : '../';
  const meta = META[lang][page];
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
<link rel="canonical" href="${attr(urlFor(lang, page))}">
<link rel="alternate" hreflang="${lang}" href="${attr(urlFor(lang, page))}">
<link rel="alternate" hreflang="${alt}" href="${attr(urlFor(alt, page))}">
<link rel="alternate" hreflang="x-default" href="${attr(urlFor('en', page))}">

<meta property="og:type" content="website">
<meta property="og:locale" content="${lang === 'bn' ? 'bn_BD' : 'en_US'}">
<meta property="og:site_name" content="${attr(biz.name)}">
<meta property="og:title" content="${attr(meta.title)}">
<meta property="og:description" content="${attr(meta.desc)}">
<meta property="og:url" content="${attr(urlFor(lang, page))}">
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
${header(t, lang, page, base)}
<main id="main">
${body}
</main>
${footer(t, lang, base)}
<script type="application/ld+json">${JSON.stringify(jsonLd(t, lang))}</script>
<script src="${base}assets/js/main.js" defer></script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------- main */
const RENDER = { home: homePage, products: productsPage, about: aboutPage, contact: contactPage };

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(src, dst);
    else fs.copyFileSync(src, dst);
  }
}

function build() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  copyDir(path.join(ROOT, 'src', 'assets'), path.join(OUT, 'assets'));

  let count = 0;
  for (const lang of ['en', 'bn']) {
    const t = copy[lang];
    const base = lang === 'en' ? '' : '../';
    const dir = lang === 'en' ? OUT : path.join(OUT, 'bn');
    fs.mkdirSync(dir, { recursive: true });
    for (const page of PAGES) {
      const body = RENDER[page](t, lang, base);
      fs.writeFileSync(path.join(dir, FILE[page]), layout({ lang, page, body, t }));
      count++;
    }
  }

  const urls = ['en', 'bn'].flatMap(lang => PAGES.map(page => ({ lang, page })));
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(({ lang, page }) => `  <url>
    <loc>${urlFor(lang, page)}</loc>
${['en', 'bn'].map(l => `    <xhtml:link rel="alternate" hreflang="${l}" href="${urlFor(l, page)}"/>`).join('\n')}
    <xhtml:link rel="alternate" hreflang="x-default" href="${urlFor('en', page)}"/>
    <changefreq>monthly</changefreq>
    <priority>${page === 'home' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), sitemap);
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
  fs.writeFileSync(path.join(OUT, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

  console.log(`Built ${count} pages (${PAGES.length} × en/bn) + sitemap + robots into dist/`);
  console.log(`Site origin: ${SITE}${process.env.SITE_URL ? ' (from SITE_URL)' : ' (from business.json)'}`);
  if (!biz.email) console.log('NOTE: business.email is null — no email is shown anywhere on the site.');
}

build();
