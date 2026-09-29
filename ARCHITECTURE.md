# Architecture

## Shape of the thing

A single Node script reads two JSON content files and writes a folder of static
HTML. That is the entire system. There is no framework, no bundler, no
`node_modules`, no lock file, and nothing runs on a server.

```
content/*.json  ──►  build.js  ──►  dist/  ──►  GitHub Pages
                        ▲
              src/assets/ (copied verbatim)
```

The reason is the audience: cheap Android phones on Dhaka mobile data. Every
kilobyte of framework is a kilobyte the customer waits for, and a shop website
that needs a build toolchain is a shop website nobody can maintain in two years.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Generator | Node 22, built-ins only | Zero install, zero supply chain, runs anywhere |
| Templating | Tagged template literals | No engine to learn or keep updated |
| Styling | One hand-written stylesheet, CSS custom properties | No build step, no purge, no utility soup |
| Client JS | ~100 lines, no dependencies | Nav, quote form, open-now badge. Nothing else needs it |
| Hosting | GitHub Pages via Actions | Free, and the repo is the deploy |
| Forms | WhatsApp deep link, plus Google Apps Script | The shop already lives in WhatsApp |

**Dependencies are the thing this project spends most carefully.** The site
loads no third-party script. The QR code is generated at build time rather than
drawn by a CDN library, because a deferred script that stalls blocks everything
behind it — and on a Dhaka mobile connection, that is exactly when it happens.
The only external request is the Google Fonts stylesheet.

Two Python tools (`tools/`, on the feature branch) use Pillow and segno. They
are run by hand, never by the site, and never by CI.

## Layout

```
build.js                  the generator — routing, layout, every page renderer
content/
  business.json           facts: address, phones, hours, map, image paths
  copy.json               all bilingual copy, en and bn at strict key parity
  reviews.json            Google reviews, typed in by hand
src/assets/
  css/styles.css          the whole stylesheet
  js/main.js              nav, quote form, open-now badge
  img/                    logo, banner, favicon (+ photos/ once they arrive)
tools/                    one-off scripts, run by hand (feature branch)
.github/workflows/        build, assert page count, deploy
dist/                     generated, gitignored
```

## Request flow

There isn't one — every page is a file on disk. What matters instead is the
**build** flow:

1. `build()` runs the content guards first and throws on any mismatch
2. `dist/` is wiped and `src/assets/` copied in whole
3. For each language, each page renderer produces a body string
4. `layout()` wraps it with head, header, footer, and the JSON-LD
5. `sitemap.xml` and `robots.txt` are written last
6. The workflow asserts the file count, then deploys

## The two ideas worth knowing

**Language is a URL, not a toggle.** English at the root, Bengali under `/bn/`,
cross-linked with `hreflang` and `x-default`. The design this was ported from
used a JavaScript switch, which produces one indexable page for two languages.
Real URLs mean Google ranks the Bengali pages for Bengali searches.

**`base` and `up` are different things.** `base` is the document-relative hop to
the site root, used for assets. `up` is the hop back to the *language* root, used
for page links. The five flat pages have `up = ''`; a trade page at
`/services/<slug>/` has `up = '../../'`. Getting these confused is the most
likely way to break links when adding a page depth.

## Content guards

`build.js` refuses to build rather than shipping something quietly wrong. Each
guard exists because the failure it catches already happened, or is one paste
away:

- The street address must appear in the display copy as well as the schema —
  they disagreed once and the footer shipped the old address
- The stated delivery-area count must match the list, in both languages, folding
  Bengali digits to ASCII first — it said "12+" beside fourteen named areas
- Every `reviews.json` entry must have a whole-number rating 1–5, a `YYYY-MM-DD`
  date, a name and text, and the total must not be lower than the reviews listed
- (feature branch) Every `photos.json` key must be a real category or trade slug

Adding a guard is cheap. Shipping a wrong address to a real business is not.

## Configuration, and graceful absence

Every integration is inert until configured, and says so at build time rather
than failing:

| Key | Empty behaviour |
| --- | --- |
| `SITE_URL` env | Falls back to `business.json`'s `url` |
| `quoteEndpoint` | Form opens WhatsApp as always; nothing is recorded |
| `reviewUrl` | Review block and QR omitted from every page |
| `reviews.items` | Reviews section omitted entirely |
| `photos/` missing | Placeholders render, sized for the real photo |

This is deliberate. The client supplies these over weeks, and the site has to be
correct at every point in between — never broken, never showing an empty frame.

## Deployment

Push to `claude/era-project-02-init-zfcj9f` (the default branch) triggers
`.github/workflows/deploy.yml`: build with `SITE_URL` from the Pages action,
assert the expected page count, upload, deploy. Pages itself had to be switched
on once by hand — `GITHUB_TOKEN` cannot create a Pages site.

`netlify.toml` exists as an alternative host if the client ever wants one.
