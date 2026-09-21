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

**GitHub Pages** is wired up. `.github/workflows/deploy.yml` builds and deploys
on every push to the default branch — but Pages has to be switched on once by
hand first:

> **Settings → Pages → Build and deployment → Source: _GitHub Actions_**

That step cannot be automated from the workflow. Creating a Pages site requires
repo-admin rights, and the `GITHUB_TOKEN` a workflow runs with does not have
them no matter what `permissions:` declares — `configure-pages` with
`enablement: true` returns *Resource not accessible by integration*. It would
need a personal access token with `repo` scope stored as a secret, which is not
worth it for one click. After that click, every push deploys itself.

The workflow runs `actions/configure-pages` *before* the build and passes the URL
Pages assigns to the generator as `SITE_URL`. That matters because a project site
is served from a sub-path (`/Era-Project-02/`), so canonical tags, `hreflang`,
Open Graph and the sitemap have to advertise that, not the production domain. All
in-page links and asset paths are document-relative, so they work at any depth.

**Netlify** — connect the repo; `netlify.toml` sets `node build.js` → `dist`.
**Vercel / Cloudflare Pages** — build `node build.js`, output `dist`.

### Going live on the real domain

`SITE_URL` overrides `content/business.json` → `url`, which is the fallback for
local and non-Pages builds. When the custom domain is ready:

```bash
SITE_URL=https://erasanitary.com.bd node build.js   # one-off check
```

Then set `url` in `content/business.json` to the real domain, and on GitHub add
the domain under Settings → Pages → Custom domain (which makes
`configure-pages` report it, so `SITE_URL` follows automatically).

Getting this wrong is not cosmetic: canonical tags pointing at the wrong origin
tell Google the real site is a duplicate.

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

1. **"U-PVC — add tube wells and vents"** — vents are already listed. Confirm
   whether tube-well pipe should sit under U-PVC as well as Pressure PVC-U.
2. **Logo** — the mark on the site is cropped out of the printed banner. A
   transparent PNG or vector original would be sharper, and is needed for print.

Answered: the email is `erasanitary2003@gmail.com`, and both numbers are treated
as equal — each is listed with its own call and WhatsApp action, both appear in
the footer and in `contactPoint` in the structured data. The header CTA, the hero
button and the quote form need a single destination, so they use whichever phone
is flagged `"primary": true` in `content/business.json`; flip that flag to swap
them over.

## Content decisions made during the port

Trade-list spellings were normalised to standard English for search and
credibility: mixture → mixer, angel → angle, heath → health, conseal →
concealed, sope → soap, tamber → tumbler, court hook → coat hook, gratin →
grating, sinck → sink, siramic/cramic → ceramic, foset → faucet, adsesive →
adhesive. The Bengali is unaffected.
