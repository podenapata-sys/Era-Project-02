# ERA Sanitary & Plumbing Solutions — website

Bilingual (English / বাংলা) static site for a sanitary and plumbing materials
supplier in Rampura, Dhaka. Every page is generated from two JSON files by one
zero-dependency Node script — **no framework, no npm install, no lock file.**

```bash
node build.js     # writes dist/
npm run serve     # build, then serve dist/ on localhost
```

## How it works

```
content/business.json   Facts: name, phones, address, hours, payments
content/copy.json       All copy, en + bn, in parity (69 keys each)
build.js                Renders dist/ — 4 pages × 2 languages + sitemap + robots
src/assets/             CSS, JS and images, copied to dist/assets verbatim
```

Output:

| URL | Bengali |
| --- | --- |
| `/` | `/bn/` |
| `/products.html` | `/bn/products.html` |
| `/about.html` | `/bn/about.html` |
| `/contact.html` | `/bn/contact.html` |

**`dist/` is generated and git-ignored.** Run `node build.js` after any content
change. Both deploy paths below build from source, so what ships is never stale.

### Why real URLs instead of a language toggle

The design this was ported from switched language in JavaScript and remembered
the choice in `localStorage`. That means one URL, so Google only ever indexes
one language and nobody can share a Bengali link. Here each language is its own
crawlable page, cross-linked with `hreflang` (plus `x-default` → English), and
the switch in the header is an ordinary `<a href>` that works with JavaScript
off. Nothing else changed about how it behaves.

## Editing content

Almost everything is in `content/copy.json`. **Keep `en` and `bn` in step** — the
build reads the same keys from both, so a key added to one and not the other
renders empty on that language's pages.

Adding a product category — append an object to `categories` in *both* `en` and
`bn`:

```json
{
  "title": "Water pumps",
  "slug": "pumps",
  "size": "0.5 HP – 2 HP",
  "blurb": "One line for the home page card.",
  "long": "A paragraph for the products page.",
  "items": ["Centrifugal pumps", "Submersible pumps"]
}
```

The card, the products-page block, the quote-form dropdown and the `OfferCatalog`
in the structured data all pick it up. If the new count leaves one card alone on
the last row, that card widens to fill the row by itself — no layout work needed.

Prices are deliberately absent. Stock and rates move; the site sends people to
WhatsApp for a current quote instead of going stale.

## The quote form

`contact.html` has no backend. On submit it composes a WhatsApp message —
greeting, name, phone, category, item list, sign-off, in whichever language the
visitor is reading — and opens `wa.me/8801711954094`. It needs either an item
list or a phone number, and says so in the right language if given neither. If a
popup blocker stops the new tab it navigates in place rather than failing
silently.

To change the number, edit `phones` in `content/business.json`; the `primary`
entry is the one the form and the CTAs use.

## Photography — the one thing still outstanding

Six photo slots render as labelled placeholders. They are **not** broken images;
they're sized to hold the real thing. Replace `photoSlot(...)` in `build.js` with
an `<img>` as each photo arrives:

| Slot | Shot needed | Ratio |
| --- | --- | --- |
| Hero | The shop front or a wall of pipe stock | ~4:3 |
| Why us | The counter, or a delivery going out | ~5:4 |
| About | Shopfront or the team | ~5:4 |
| 7 × category | One representative shot per category | ~4:3 |

Phone photos in daylight are fine. Shot straight-on, in focus, no flash.

## Deploying

**Netlify** — connect the repo. `netlify.toml` sets `node build.js` → `dist`.
**Vercel / Cloudflare Pages** — build `node build.js`, output `dist`.
**GitHub Pages** — `.github/workflows/deploy.yml` builds and deploys on push to
`main`; enable Pages with source "GitHub Actions" in repo settings.

Set the real domain in `content/business.json` → `url` **before** going live. It
feeds the canonical tags, `hreflang`, Open Graph, `sitemap.xml` and `robots.txt`.

## Accessibility

Every foreground/background pair was measured, not eyeballed. Body text is
17.7:1, muted copy 12.1:1, the lightest grey 7.8:1 — all past the 4.5:1 AA
minimum. Form-field and ghost-button borders use a separate lighter token
(`--line-ui`, 3.75:1) because the border is the only thing marking those
controls; the decorative borders stay dark. Also: skip link, visible focus
rings, `aria-expanded` on the menu, `aria-current` on the active nav item, real
`<label>`s, `role="alert"` on the form error, and a full
`prefers-reduced-motion` path that stops the delivery-areas marquee.

Bengali sets `lang="bn"` and renders in Hind Siliguri; phone numbers use Bengali
numerals in Bengali copy while `tel:` links stay in Latin digits so dialling works.

## Open questions for the client

1. **Email address** — asked for but not supplied, so no email appears anywhere.
   Add it to `content/business.json` → `email` and it can be surfaced.
2. **Which number is primary?** Both 01711-954094 and 01611-954094 are on the
   banner. 01711 is currently the WhatsApp and form target.
3. **"U-PVC — add tube wells and vents"** — vents are already listed. Confirm
   whether tube-well pipe should sit under U-PVC as well as Pressure PVC-U.
4. **Logo** — the mark on the site is cropped out of the printed banner. A
   transparent PNG or vector original would be sharper, and is needed for print.

## Content decisions made during the port

Trade-list spellings were normalised to standard English for search and
credibility: mixture → mixer, angel → angle, heath → health, conseal →
concealed, sope → soap, tamber → tumbler, court hook → coat hook, gratin →
grating, sinck → sink, siramic/cramic → ceramic, foset → faucet, adsesive →
adhesive. The Bengali is unaffected.
