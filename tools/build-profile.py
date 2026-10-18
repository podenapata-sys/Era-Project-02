#!/usr/bin/env python3
"""Build the ERA company profile as a bilingual A4 PDF.

    python3 tools/build-profile.py          # writes era-company-profile.pdf

Everything in the document comes out of content/business.json and
content/copy.json. Nothing about the business is written here, and nothing is
invented: no customer counts, no ratings, no client list, no certifications, no
prices. If a fact is not in content/ it is left out. See RULES.md rule 1 — a
company profile is exactly the document that invites "20+ years of excellence
and 1000+ satisfied clients", and every one of those would be a lie.

Because it reads content/, the profile regenerates rather than drifting from the
website. Re-run it after any content change.

WHAT IT NEEDS

    pip install playwright       # the browser is already installed here
    tools/.fonts/*.ttf           # fetched automatically on first run

Fonts are downloaded with curl rather than loaded by the browser: Chromium's TLS
to Google Fonts is blocked in this sandbox, and a PDF that silently falls back
is worse than one that fails. They are cached in tools/.fonts/ and gitignored —
both faces are OFL, and committing them would mean carrying the licence text for
something the script can fetch in a second.

WHY A BROWSER AND NOT A PDF LIBRARY

Bengali needs real text shaping. Its conjuncts (ক্ত, ঙ্গ), its reph and its
vowel signs that sit to the LEFT of the consonant they follow are not
glyph-after-glyph work, and a PDF library that lays out runs by hand gets them
subtly wrong — wrong enough that an English reader proof-reading the file would
never notice. Chromium already has HarfBuzz, so it is the shaping engine, and
this script only has to write HTML.
"""

import json
import io
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, 'tools', '.fonts')
OUT = os.path.join(ROOT, 'era-company-profile.pdf')
OUT_SUPPLY = os.path.join(ROOT, 'era-supply-list.pdf')
UPDATES = os.path.join(ROOT, 'updates')

# Which UI string render_pages() prints in the top-right of every page. The
# profile says "Company profile"; the supply sheet must not, and hardcoding a
# second string inside the renderer would put copy somewhere nobody looks.
DOC = 'profile'

# The two faces the website uses, so the profile reads as the same business.
FACES = [
    ('Barlow', 'Barlow:wght@400;600;800', ['400', '600', '800']),
    ('Noto Sans Bengali', 'Noto+Sans+Bengali:wght@400;600', ['400', '600']),
]


# --------------------------------------------------------------------------
# Fonts

def slug_of(name):
    return name.lower().replace(' ', '-')


def fetch_fonts():
    """Download any missing face into tools/.fonts/. Idempotent."""
    os.makedirs(FONTS, exist_ok=True)
    missing = [(n, s, w) for n, s, ws in FACES for w in ws
               if not os.path.exists(os.path.join(FONTS, '%s-%s.ttf' % (slug_of(n), w)))]
    if not missing:
        return
    print('Fetching %d font file(s) into tools/.fonts/ ...' % len(missing))
    for name, spec, _ in FACES:
        css = subprocess.run(
            ['curl', '-sSL', '--max-time', '40',
             'https://fonts.googleapis.com/css2?family=%s' % spec],
            capture_output=True).stdout.decode('utf-8', 'replace')
        for block in re.findall(r'@font-face\s*\{(.*?)\}', css, re.S):
            w = re.search(r'font-weight:\s*(\d+)', block)
            u = re.search(r'url\((https://fonts\.gstatic\.com[^)]+)\)', block)
            if not (w and u):
                continue
            dest = os.path.join(FONTS, '%s-%s.ttf' % (slug_of(name), w.group(1)))
            if os.path.exists(dest):
                continue
            subprocess.run(['curl', '-sSL', '--max-time', '60', '-o', dest, u.group(1)],
                           check=True)
            # A failed download that leaves an HTML error page behind would make
            # Bengali fall back to a non-shaping face, which looks plausible and
            # is wrong. Check the sfnt signature instead of trusting the exit code.
            with open(dest, 'rb') as f:
                if f.read(4) not in (b'\x00\x01\x00\x00', b'true', b'OTTO'):
                    os.remove(dest)
                    sys.exit('%s did not come back as a font. Try again when the '
                             'network is up.' % os.path.basename(dest))


def font_face_css():
    out = []
    for name, _, weights in FACES:
        for w in weights:
            path = os.path.join(FONTS, '%s-%s.ttf' % (slug_of(name), w))
            out.append("@font-face{font-family:'%s';font-weight:%s;font-style:normal;"
                       "font-display:block;src:url('file://%s') format('truetype')}"
                       % (name, w, path))
    return '\n'.join(out)


# --------------------------------------------------------------------------
# Content

def esc(v):
    return (str('' if v is None else v)
            .replace('&', '&amp;').replace('<', '&lt;')
            .replace('>', '&gt;').replace('"', '&quot;'))


biz = json.load(io.open(os.path.join(ROOT, 'content', 'business.json'), encoding='utf-8'))
copy = json.load(io.open(os.path.join(ROOT, 'content', 'copy.json'), encoding='utf-8'))

BN_DIGITS = '০১২৩৪৫৬৭৮৯'


def digits(s, lang):
    """Bengali numerals in Bengali copy, matching what the site already does."""
    if lang != 'bn':
        return s
    return re.sub(r'[0-9]', lambda m: BN_DIGITS[int(m.group())], str(s))


def phone_display(p, lang):
    return p.get('displayBn') if lang == 'bn' and p.get('displayBn') else p['display']


# Labels for the parts of the document that are structure rather than content.
# /admin/ sets the precedent for English-only chrome, but this document is read
# by a customer, so both languages are written out here rather than invented at
# render time in one.
UI = {
    'en': {
        'profile': 'Company profile',
        'productList': 'Product list',
        'update': 'Update',
        'since': 'Supplying Dhaka since',
        'contact': 'Contact',
        'phone': 'Phone / WhatsApp',
        'email': 'Email',
        'address': 'Address',
        'maps': 'Google Maps',
        'hours': 'Opening hours',
        'payments': 'Payments accepted',
        'amenities': 'In store & service options',
        'areas': 'Delivery areas',
        'range': 'Size range',
        'credentials': 'Registration',
        'credNote': 'To be completed by ERA Sanitary & Plumbing Solutions.',
        'licence': 'Trade Licence No.',
        'tin': 'TIN',
        'bin': 'BIN / VAT Registration',
        'page': 'Page',
    },
    'bn': {
        'profile': 'কোম্পানি প্রোফাইল',
        'productList': 'পণ্যের তালিকা',
        'update': 'আপডেট',
        'since': 'ঢাকায় সরবরাহ করছি',
        'contact': 'যোগাযোগ',
        'phone': 'ফোন / হোয়াটসঅ্যাপ',
        'email': 'ইমেইল',
        'address': 'ঠিকানা',
        'maps': 'গুগল ম্যাপস',
        'hours': 'খোলার সময়',
        'payments': 'গৃহীত পেমেন্ট',
        'amenities': 'দোকানে ও সেবার সুবিধা',
        'areas': 'ডেলিভারি এলাকা',
        'range': 'সাইজ',
        'credentials': 'নিবন্ধন',
        'credNote': 'ERA Sanitary & Plumbing Solutions কর্তৃক পূরণীয়।',
        'licence': 'ট্রেড লাইসেন্স নং',
        'tin': 'টিআইএন',
        'bin': 'বিআইএন / ভ্যাট নিবন্ধন',
        'page': 'পৃষ্ঠা',
    },
}


# --------------------------------------------------------------------------
# Rendering

PAGES = []          # filled as pages are built, so the footer can number them


def page(lang, body, kicker=''):
    PAGES.append((lang, body, kicker))


def render_pages():
    total = len(PAGES)
    out = []
    for i, (lang, body, kicker) in enumerate(PAGES, 1):
        u = UI[lang]
        foot = ('<div class="foot"><span>%s</span><span>%s %s / %s</span></div>'
                % (esc(biz['name']), esc(u['page']),
                   esc(digits(i, lang)), esc(digits(total, lang))))
        head = ('<div class="runhead"><span>%s</span><span>%s</span></div>'
                % (esc(kicker), esc(u[DOC]))) if kicker else '<div class="runhead"></div>'
        out.append('<section class="page" lang="%s">%s<div class="body">%s</div>%s</section>'
                   % (lang, head, body, foot))
    return '\n'.join(out)


def cover(lang):
    t = copy[lang]
    u = UI[lang]
    primary = next((p for p in biz['phones'] if p.get('primary')), biz['phones'][0])
    phones = ' &nbsp;·&nbsp; '.join(esc(phone_display(p, lang)) for p in biz['phones'])
    return """
      <div class="cover">
        <div class="cover__hero">
          <img class="cover__badge" src="file://{logo}" alt="">
          <h1 class="cover__name">{name}</h1>
          <p class="cover__tag">{tagline}</p>
          <div class="cover__rule"></div>
          <p class="cover__since">{since} <strong>{year}</strong></p>
        </div>
        <div class="cover__foot">
          <p class="cover__addr">{address}</p>
          <p class="cover__contact">{phones}</p>
          <p class="cover__contact">{email}</p>
        </div>
      </div>""".format(
        logo=os.path.join(ROOT, 'src', 'assets', 'img', 'era-logo.png'),
        name=esc(biz['name']),
        tagline=esc(t['tagline']),
        since=esc(u['since']),
        year=esc(digits(biz['since'], lang)),
        address=esc(t['address']),
        phones=phones,
        email=esc(biz['email']),
    )


def about(lang):
    t = copy[lang]
    stats = ''.join(
        '<div class="stat"><strong>%s</strong><span>%s</span></div>'
        % (esc(digits(s['value'], lang)), esc(s['label'])) for s in t['stats'])
    pillars = ''.join(
        '<div class="pillar"><span class="pillar__n">%s</span>'
        '<h3>%s</h3><p>%s</p></div>'
        % (esc(digits(p['n'], lang)), esc(p['title']), esc(p['body'])) for p in t['pillars'])
    reasons = ''.join(
        '<div class="reason"><h3>%s</h3><p>%s</p></div>'
        % (esc(r['title']), esc(r['body'])) for r in t['reasons'])
    return """
      <h2 class="h2">{aboutTitle}</h2>
      <p class="lede">{p1}</p>
      <p>{p2}</p>
      <p>{p3}</p>
      <div class="stats">{stats}</div>
      <div class="pillars">{pillars}</div>
      <h2 class="h2 h2--sp">{whyTitle}</h2>
      <div class="reasons">{reasons}</div>""".format(
        aboutTitle=esc(t['aboutTitle']), p1=esc(t['aboutP1']), p2=esc(t['aboutP2']),
        p3=esc(t['aboutP3']), stats=stats, pillars=pillars,
        whyTitle=esc(t['whyTitle']), reasons=reasons)


def supply_header(lang):
    """The band at the top of page 1 of the standalone supply sheet.

    A product list with no phone number on it is wastepaper. The company
    profile can afford to put contact details on their own page because the
    reader has the whole brochure; a two-page sheet forwarded on WhatsApp
    cannot, so the name, both numbers and the address travel with the list.

    A band and not a cover() page: this document is two pages and the products
    are the content, not the branding. Logo, name, tagline, phones and address
    all come from the same helpers the cover uses.
    """
    t = copy[lang]
    u = UI[lang]
    phones = ' &nbsp;·&nbsp; '.join(esc(phone_display(p, lang)) for p in biz['phones'])
    return """
      <div class="sheet-head">
        <img class="sheet-head__badge" src="file://{logo}" alt="">
        <div class="sheet-head__text">
          <h1 class="sheet-head__name">{name}</h1>
          <p class="sheet-head__tag">{tagline}</p>
          <p class="sheet-head__meta">{address}</p>
          <p class="sheet-head__meta">{phones} &nbsp;·&nbsp; {email}</p>
        </div>
      </div>""".format(
        logo=os.path.join(ROOT, 'src', 'assets', 'img', 'era-logo.png'),
        name=esc(biz['name']), tagline=esc(t['tagline']),
        address=esc(t['address']), phones=phones, email=esc(biz['email']))


def supply(lang, slice_):
    t = copy[lang]
    u = UI[lang]
    cards = ''
    for c in t['categories'][slice_]:
        items = ''.join('<li>%s</li>' % esc(i) for i in c['items'])
        cards += """
          <div class="cat">
            <h3>{title}</h3>
            <p class="cat__size">{rangeLabel}: {size}</p>
            <p class="cat__long">{long}</p>
            <ul class="cat__items">{items}</ul>
          </div>""".format(title=esc(c['title']), rangeLabel=esc(u['range']),
                           size=esc(c['size']), long=esc(c['long']), items=items)
    head = ('<h2 class="h2">%s</h2><p class="lede">%s</p>'
            % (esc(t['supplyTitle']), esc(t['productsIntro']))) if slice_.start in (0, None) else ''
    return head + '<div class="cats">%s</div>' % cards


def load_update(date=None):
    """The newest file in updates/, or the one named by --date.

    Kept out of content/ deliberately: content/ is what the website is built
    from and build.js guards it. A dated status report is neither, and putting
    it there would mean a progress note could fail a site content check.
    """
    if not os.path.isdir(UPDATES):
        sys.exit('there is no updates/ directory.  Add updates/<date>.json first.')
    files = sorted(f for f in os.listdir(UPDATES) if f.endswith('.json'))
    if not files:
        sys.exit('updates/ has no .json file to render.')
    name = (date + '.json') if date else files[-1]
    path = os.path.join(UPDATES, name)
    if not os.path.exists(path):
        sys.exit('no such update: %s\nHave: %s' % (name, ', '.join(files)))
    return json.load(io.open(path, encoding='utf-8'))


def update_asks(d):
    """Page 1: what the client has to send, before anything we have done.

    The order is the whole point. This document exists to collect three things;
    a reader who has to reach page 2 to find them will not reach page 2.
    """
    asks = ''.join("""
      <div class="ask">
        <div class="ask__n">{n}</div>
        <div class="ask__body">
          <h3>{title}</h3>
          <p class="ask__how">{how}</p>
          {items}
          <p class="ask__why">{why}</p>
        </div>
      </div>""".format(
        n=esc(a['n']), title=esc(a['title']), how=esc(a['how']),
        why=esc(a['why']),
        items=('<ul class="bullets">%s</ul>'
               % ''.join('<li>%s</li>' % esc(i) for i in a['items']))
              if a['items'] else '')
        for a in d['asks'])

    return """
      <h2 class="h2">{asksTitle}</h2>
      <p class="lede">{lede}</p>
      <div class="asks">{asks}</div>""".format(
        asksTitle=esc(d['asksTitle']), lede=esc(d['lede']), asks=asks)


def update_status(d):
    """Page 2: the question, the decision, then what exists.

    The question and the decision were on page 1 with the asks and pushed the
    body 47px past its box, printing the last line across the footer. They
    belong here anyway: page 1 asks for three things, and a fourth and fifth
    item under them dilutes exactly the thing the document is for.
    """
    def ul(items):
        return '<ul class="bullets">%s</ul>' % ''.join(
            '<li>%s</li>' % esc(i) for i in items)
    side = ''.join(
        '<div class="side"><span class="side__label">%s</span><p>%s</p></div>'
        % (esc(x['label']), esc(x['text'])) for x in d['side'])
    return """
      <h2 class="h2">{sideTitle}</h2>
      {side}

      <h2 class="h2 h2--sp">{todayTitle}</h2>
      {today}

      <h2 class="h2 h2--sp">{doneTitle}</h2>
      {done}

      <div class="closing"><p>{closing}</p></div>""".format(
        todayTitle=esc(d['todayTitle']), today=ul(d['today']),
        doneTitle=esc(d['doneTitle']), done=ul(d['done']),
        sideTitle=esc(d['sideTitle']), side=side,
        closing=esc(d['closing']))


def works(lang):
    t = copy[lang]
    cards = ''.join(
        '<div class="svc"><h3>%s</h3><p>%s</p></div>' % (esc(s['title']), esc(s['blurb']))
        for s in t['services'])
    return """
      <h2 class="h2">{title}</h2>
      <p class="lede">{intro}</p>
      <div class="svcs">{cards}</div>""".format(
        title=esc(t['worksTitle']), intro=esc(t['servicesIntro']), cards=cards)


def reach(lang):
    t = copy[lang]
    u = UI[lang]
    areas = ''.join('<li>%s</li>' % esc(a) for a in t['areas'])
    hours = ''.join('<tr><td>%s</td><td>%s</td></tr>'
                    % (esc(h['label']), esc(digits(h['value'], lang))) for h in t['hours'])
    pays = ''.join('<li>%s</li>' % esc(p) for p in t['payments'])
    amen = ''.join('<li>%s</li>' % esc(a) for a in t['amenities'])
    return """
      <h2 class="h2">{areasTitle}</h2>
      <ul class="chips">{areas}</ul>
      <h2 class="h2 h2--sp">{hoursTitle}</h2>
      <table class="hours">{hours}</table>
      <p class="note">{hoursNote}</p>
      <div class="two">
        <div><h2 class="h2">{amenTitle}</h2><ul class="bullets">{amen}</ul></div>
        <div><h2 class="h2">{payTitle}</h2><ul class="bullets">{pays}</ul></div>
      </div>""".format(
        areasTitle=esc(t['areasTitle']), areas=areas,
        hoursTitle=esc(t['hoursTitle']), hours=hours, hoursNote=esc(t['hoursNote']),
        amenTitle=esc(u['amenities']), amen=amen,
        payTitle=esc(u['payments']), pays=pays)


def contact(lang):
    t = copy[lang]
    u = UI[lang]
    rows = ''.join(
        '<tr><td>%s</td><td>%s<span class="tel">%s</span></td></tr>'
        % (esc(u['phone']), esc(phone_display(p, lang)),
           '' if lang != 'bn' else ' &nbsp;<span dir="ltr">%s</span>' % esc(p['display']))
        for p in biz['phones'])
    return """
      <h2 class="h2">{contactTitle}</h2>
      <table class="kv">
        <tr><td>{addrLabel}</td><td>{address}</td></tr>
        {rows}
        <tr><td>{emailLabel}</td><td><span dir="ltr">{email}</span></td></tr>
        <tr><td>{mapsLabel}</td><td><span dir="ltr">{maps}</span></td></tr>
      </table>

      <h2 class="h2 h2--sp">{credTitle}</h2>
      <p class="note">{credNote}</p>
      <table class="kv kv--blank">
        <tr><td>{licence}</td><td class="blank"></td></tr>
        <tr><td>{tin}</td><td class="blank"></td></tr>
        <tr><td>{bin}</td><td class="blank"></td></tr>
      </table>

      <div class="endmark">
        <img src="file://{logo}" alt="">
        <p>{tagline}</p>
      </div>""".format(
        contactTitle=esc(t['contactTitle']),
        addrLabel=esc(u['address']), address=esc(t['address']), rows=rows,
        emailLabel=esc(u['email']), email=esc(biz['email']),
        mapsLabel=esc(u['maps']), maps=esc(biz['maps']['placeUrl']),
        credTitle=esc(u['credentials']), credNote=esc(u['credNote']),
        licence=esc(u['licence']), tin=esc(u['tin']), bin=esc(u['bin']),
        logo=os.path.join(ROOT, 'src', 'assets', 'img', 'era-logo.png'),
        tagline=esc(t['tagline']))


CSS = """
*,*::before,*::after{box-sizing:border-box}
html,body{margin:0;padding:0}
:root{
  /* Measured off the client's own badge, not guessed from a photograph.
     Contrast against the white page is in the comment beside each one — the
     gold is unusable as text at 1.94:1 and is only ever a rule or a block. */
  --blue:#0090E4;        /* 3.44:1 - large headings only */
  --blue-ink:#0074B8;    /* 5.01:1 - labels, small emphasis */
  --blue-deep:#00578A;   /* 7.69:1 */
  --gold:#E4B40C;        /* 1.94:1 - never text */
  --ink:#1A1A1A;
  --muted:#5A5F66;       /* 6.44:1 */
  --line:#D8DDE3;
  --wash:#F4F7FA;
}
body{font-family:'Barlow',sans-serif;color:var(--ink);font-size:10.4pt;line-height:1.55}
[lang="bn"]{font-family:'Noto Sans Bengali','Barlow',sans-serif;line-height:1.75}

@page{size:A4;margin:0}
.page{
  width:210mm;height:297mm;padding:14mm 16mm 10mm;
  display:flex;flex-direction:column;page-break-after:always;position:relative;
}
.page:last-child{page-break-after:auto}
.body{flex:1 1 auto;min-height:0}

.runhead{
  display:flex;justify-content:space-between;align-items:baseline;
  font-size:7.6pt;letter-spacing:.08em;text-transform:uppercase;
  color:var(--blue-ink);font-weight:600;
  padding-bottom:3mm;margin-bottom:6mm;border-bottom:1.5pt solid var(--gold);
}
.runhead:empty{border:0;margin-bottom:0;padding:0}
.foot{
  display:flex;justify-content:space-between;font-size:7.4pt;color:var(--muted);
  border-top:.75pt solid var(--line);padding-top:2.5mm;margin-top:6mm;
}

/* ---- cover ---- */
.cover{height:100%;display:flex;flex-direction:column;text-align:center}
.cover__hero{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center}
.cover__badge{width:58mm;height:58mm;object-fit:contain}
.cover__name{font-size:28pt;font-weight:800;line-height:1.15;margin:8mm 0 0;color:var(--blue-deep);max-width:150mm}
.cover__tag{font-size:13pt;color:var(--blue);font-weight:600;margin:3mm 0 0;font-style:italic}
.cover__rule{width:34mm;height:2.5pt;background:var(--gold);margin:7mm 0}
.cover__since{font-size:11.5pt;color:var(--muted);margin:0}
.cover__since strong{color:var(--ink);font-weight:800}
.cover__foot{padding-top:10mm;border-top:.75pt solid var(--line);width:100%}
.cover__addr{font-size:11pt;font-weight:600;margin:0 0 2mm;color:var(--ink)}
.cover__contact{font-size:10.4pt;color:var(--muted);margin:0 0 1mm}
.sheet-head{display:flex;gap:6mm;align-items:center;padding-bottom:4mm;margin-bottom:6mm;border-bottom:1.5pt solid var(--gold)}
.sheet-head__badge{width:20mm;height:20mm;object-fit:contain;flex:0 0 20mm}
.sheet-head__name{font-size:17pt;font-weight:800;color:var(--blue-deep);margin:0;line-height:1.15}
.sheet-head__tag{font-size:10pt;font-weight:600;font-style:italic;color:var(--blue);margin:1mm 0 2mm}
.sheet-head__meta{font-size:9.4pt;color:var(--muted);margin:0 0 .8mm}

/* ---- type ---- */
.h2{font-size:16pt;font-weight:800;color:var(--blue-deep);margin:0 0 3mm;line-height:1.2}
.h2--sp{margin-top:10mm}
.lede{font-size:11.2pt;color:var(--ink);margin:0 0 5mm}
p{margin:0 0 3mm}
h3{margin:0 0 1.8mm;font-size:11.2pt;font-weight:700;color:var(--ink)}

/* ---- about ---- */
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:3.5mm;margin:8mm 0}
.stat{background:var(--wash);border-left:2pt solid var(--gold);padding:3mm 3.5mm}
.stat strong{display:block;font-size:19pt;font-weight:800;color:var(--blue-deep);line-height:1.1}
.stat span{display:block;font-size:8.6pt;color:var(--muted);margin-top:1mm}
.pillars{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm;margin-top:7mm}
.pillar__n{font-size:8pt;font-weight:800;color:var(--gold);letter-spacing:.1em}
.pillar p{font-size:9.8pt;color:var(--muted);margin:0}
.reasons{display:grid;grid-template-columns:1fr 1fr;gap:6mm 7mm}
.reason p{font-size:9.8pt;color:var(--muted);margin:0}

/* ---- categories ---- */
.cats{display:grid;grid-template-columns:1fr 1fr;gap:7mm 7mm}
.cat{break-inside:avoid;border-top:1.5pt solid var(--blue);padding-top:2.5mm}
.cat__size{font-size:9pt;font-weight:600;color:var(--blue-ink);margin:0 0 1.5mm}
.cat__long{font-size:9.8pt;color:var(--muted);margin:0 0 2mm}
.cat__items{margin:0;padding-left:4.5mm;font-size:9.4pt;color:var(--ink);columns:2;column-gap:4mm}
.cat__items li{margin-bottom:.6mm;break-inside:avoid}

/* ---- services ---- */
.svcs{display:grid;grid-template-columns:1fr 1fr;gap:6mm 7mm}
.svc{break-inside:avoid;border-left:1.5pt solid var(--gold);padding-left:3mm}
.svc p{font-size:9.6pt;color:var(--muted);margin:0}

/* ---- reach ---- */
.chips{list-style:none;margin:0 0 2mm;padding:0;display:flex;flex-wrap:wrap;gap:2mm}
.chips li{background:var(--wash);border:.75pt solid var(--line);border-radius:2mm;padding:1.6mm 3.5mm;font-size:9.8pt}
.hours{width:100%;border-collapse:collapse;font-size:10.4pt}
.hours td{padding:2.8mm 0;border-bottom:.75pt solid var(--line)}
.hours td:last-child{text-align:right;font-weight:700;white-space:nowrap}
.note{font-size:9.2pt;color:var(--muted);margin:2.5mm 0 0}
.two{display:grid;grid-template-columns:1fr 1fr;gap:6mm;margin-top:8mm}
.bullets{margin:0;padding-left:4.5mm;font-size:9.8pt;color:var(--ink)}
.bullets li{margin-bottom:1.6mm}

/* ---- client update ---- */
.asks{display:flex;flex-direction:column;gap:5mm}
.ask{display:flex;gap:4mm;break-inside:avoid;background:var(--wash);
     border-left:2.5pt solid var(--gold);padding:3.5mm 4mm}
.ask__n{flex:0 0 9mm;height:9mm;border-radius:50%;background:var(--blue-deep);
        color:#fff;font-weight:800;font-size:12pt;display:flex;
        align-items:center;justify-content:center;line-height:1}
.ask__body{flex:1 1 auto;min-width:0}
.ask__how{font-size:9.8pt;color:var(--ink);margin:0 0 2mm}
.ask__why{font-size:9pt;color:var(--muted);margin:2mm 0 0;font-style:italic}
.ask .bullets{margin:0 0 1mm}
.side{border-left:1.5pt solid var(--blue);padding-left:3.5mm;margin-bottom:4mm}
.side__label{font-size:8pt;font-weight:800;color:var(--blue-ink);
             letter-spacing:.08em}
.side p{font-size:9.8pt;color:var(--muted);margin:.8mm 0 0}
.closing{margin-top:10mm;background:var(--wash);border-left:2.5pt solid var(--blue);
         padding:4mm}
.closing p{margin:0;font-size:11pt;font-weight:600;color:var(--blue-deep)}

/* ---- contact ---- */
.kv{width:100%;border-collapse:collapse;font-size:10.6pt}
.kv td{padding:3.4mm 0;border-bottom:.75pt solid var(--line);vertical-align:top}
.kv td:first-child{width:48mm;color:var(--blue-ink);font-weight:600}
/* Only the write-on cell carries a rule, and both cells sit on the same
   baseline — otherwise the label floats above a rule that starts lower and the
   block reads as broken rather than as something to fill in. */
.kv--blank td{padding:5mm 0 1.5mm;border-bottom:0;vertical-align:bottom}
.blank{border-bottom:1pt solid var(--ink) !important}
.tel{color:var(--muted)}
.endmark{margin-top:14mm;text-align:center}
.endmark img{width:22mm;height:22mm;object-fit:contain;opacity:.95}
.endmark p{margin:3mm 0 0;font-size:10pt;font-weight:600;color:var(--blue);font-style:italic}
"""


SHELL = """<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>%s</title>
<style>%s
%s</style></head>
<body>%s</body></html>"""


def build_html(supply_only=False, update=None):
    """The profile, or — with --supply — just the product list in English.

    The supply sheet reuses supply() and the same 4/3 split the profile already
    uses, so the two documents cannot disagree about what is stocked. Only the
    wrapper differs: an identity band instead of a cover, and no about,
    services, reach or contact pages.
    """
    if update is not None:
        page('bn', supply_header('bn') + update_asks(update), update['dateDisplay'])
        page('bn', update_status(update), update['dateDisplay'])
        return SHELL % (esc(biz['name']), font_face_css(), CSS, render_pages())

    if supply_only:
        page('en', supply_header('en') + supply('en', slice(0, 4)),
             copy['en']['supplyTitle'])
        page('en', supply('en', slice(4, 7)), copy['en']['supplyTitle'])
        return SHELL % (esc(biz['name']), font_face_css(), CSS, render_pages())

    for lang in ('en', 'bn'):
        t = copy[lang]
        page(lang, cover(lang))
        page(lang, about(lang), t['aboutTitle'])
        page(lang, supply(lang, slice(0, 4)), t['supplyTitle'])
        page(lang, supply(lang, slice(4, 7)), t['supplyTitle'])
        page(lang, works(lang), t['worksTitle'])
        page(lang, reach(lang), t['areasTitle'])
        page(lang, contact(lang), t['contactTitle'])

    return SHELL % (esc(biz['name']), font_face_css(), CSS, render_pages())


def check_everything_rendered(html, supply_only=False, update=None):
    """Every catalogue item, trade and area from content/ is in the markup.

    Checked against the HTML and not the finished PDF, because pdftotext is not
    a usable oracle for Bengali: it extracts in VISUAL order, and Bengali's
    pre-base vowel signs (ি, ে, ৈ) are drawn before the consonant they are
    stored after. The codepoints come back reordered and never match the source
    string, so a perfectly good page reads as missing content. The markup is
    generated from content/ directly, so this is the exact comparison.
    """
    missing = []
    # An update carries no catalogue at all, so the loop below would fail a
    # perfectly correct document. Scoped, not skipped — and the thing worth
    # asserting here is different: this document exists to carry three asks, so
    # an ask silently dropped is the failure to catch. Every ask, every status
    # line, and the message that goes with them.
    if update is not None:
        wanted = ([a['title'] for a in update['asks']]
                  + [a['how'] for a in update['asks']]
                  + [i for a in update['asks'] for i in a['items']]
                  + [x['text'] for x in update['side']]
                  + list(update['today']) + list(update['done'])
                  + [update['lede'], update['closing']])
        missing = [w for w in wanted if esc(w) not in html]
        if missing:
            sys.exit('content missing from the update:\n  ' + '\n  '.join(missing))
        # Matched on the title alone, never on a['n']. The numeral arm that
        # used to be here could not fail: ৩ occurs five times in the ordinary
        # prose of this very message — ৩২টি পেজ, ৩টি জিনিস, ৩টি ছবি, ৩টি পেলে,
        # ছবি ৩টিই — so the `or` always matched and an ask deleted outright
        # from the message still built clean. A title is a distinctive phrase;
        # a digit in Bengali prose is noise.
        for a in update['asks']:
            if a['title'] not in update['whatsapp']:
                sys.exit('ask %s (%s) is in the PDF but not in the WhatsApp '
                         'message.\nBoth come from the same file so they cannot '
                         'disagree; add it to "whatsapp".' % (a['n'], a['title']))
        return

    # The supply sheet is English, and carries the catalogue and nothing else —
    # so the services, areas, payments and amenities are legitimately absent and
    # checking for them would fail a correct document. Scoped, not skipped: a
    # category quietly dropping off a sheet nobody proofreads is exactly what
    # this function exists to catch.
    langs = ('en',) if supply_only else ('en', 'bn')
    for lang in langs:
        t = copy[lang]
        wanted = (
            [c['title'] for c in t['categories']]
            + [i for c in t['categories'] for i in c['items']]
        )
        if not supply_only:
            wanted += ([s['title'] for s in t['services']]
                       + list(t['areas']) + list(t['payments']) + list(t['amenities']))
        missing += ['%s: %s' % (lang, w) for w in wanted if esc(w) not in html]
    if missing:
        sys.exit('content missing from the %s:\n  '
                 % ('supply sheet' if supply_only else 'profile')
                 + '\n  '.join(missing))


def check_nothing_clipped(pg):
    """No page is taller than the sheet it is printed on.

    .page is a fixed 297mm box. Anything past that is simply not printed — no
    warning, no reflow, the items at the bottom just stop existing. Adding one
    category to content/ is enough to do it, and the person who adds it is not
    going to count items in a 14-page PDF. So measure it.
    """
    # Both boxes, and .body is the one that actually catches things. .page is a
    # fixed 297mm box, but .body inside it is flex:1 1 auto with min-height:0 —
    # so a body that outgrows its share does NOT push .page's scrollHeight out.
    # It just draws over the footer, which is how the first client update went
    # out with its last line printed across the page number. Measuring .page
    # alone said that document was fine.
    over = pg.evaluate("""() => Array.from(document.querySelectorAll('.page'))
        .map((p, i) => ({
            i: i + 1,
            over: Math.max(
                Math.round(p.scrollHeight - p.clientHeight),
                ...Array.from(p.querySelectorAll('.body'))
                    .map(b => Math.round(b.scrollHeight - b.clientHeight))),
        }))
        .filter(x => x.over > 1)""")
    if over:
        sys.exit('content is being clipped off the bottom of %d page(s):\n  '
                 % len(over) + '\n  '.join(
                     'page %d overflows by %dpx' % (o['i'], o['over']) for o in over)
                 + '\nMove a block to the next page in build_html().')


def main():
    global DOC
    args = sys.argv[1:]
    supply_only = '--supply' in args
    update = None

    if '--update' in args:
        date = next((a.split('=', 1)[1] for a in args if a.startswith('--date=')), None)
        update = load_update(date)
        DOC = 'update'
        out = os.path.join(ROOT, 'era-update-%s.pdf' % update['date'])
    elif supply_only:
        DOC = 'productList'          # the running head, top-right of every page
        out = OUT_SUPPLY
    else:
        out = OUT

    fetch_fonts()
    html = build_html(supply_only, update)
    check_everything_rendered(html, supply_only, update)
    tmp = os.path.join(ROOT, 'tools', '.profile.html')
    io.open(tmp, 'w', encoding='utf-8').write(html)

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit('playwright is not installed.  pip install playwright')

    exe = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe if os.path.exists(exe) else None)
        pg = b.new_page()
        pg.goto('file://' + tmp, wait_until='load')
        # Belt and braces: without the fonts actually loaded, Bengali falls back
        # to a face that does no shaping and produces plausible-looking nonsense.
        pg.evaluate('document.fonts.ready')
        pg.wait_for_timeout(600)
        check_nothing_clipped(pg)
        pg.pdf(path=out, format='A4', print_background=True,
               prefer_css_page_size=True,
               margin={'top': '0', 'right': '0', 'bottom': '0', 'left': '0'})
        b.close()
    os.remove(tmp)

    print('Wrote %s (%.0f KB, %d pages)'
          % (os.path.relpath(out, ROOT), os.path.getsize(out) / 1024, len(PAGES)))

    # The message travels with the PDF, so it is written from the same file and
    # at the same moment. A message typed separately drifts from the document
    # it is attached to within one revision.
    if update is not None:
        msg = os.path.join(ROOT, 'era-update-%s.txt' % update['date'])
        io.open(msg, 'w', encoding='utf-8').write(update['whatsapp'] + '\n')
        print('Wrote %s (the WhatsApp message, ready to copy)'
              % os.path.relpath(msg, ROOT))


if __name__ == '__main__':
    main()
