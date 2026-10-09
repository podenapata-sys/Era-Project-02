# Tasks

Ordered by what unblocks getting paid, not by what is interesting. Status as of
2026-09-29, live branch at `086e08e`.

---

## Phase 0 — Done and live

- [x] Port the design to a real bilingual static site, EN at root and BN at `/bn/`
- [x] `hreflang` + `x-default`, sitemap, robots
- [x] 7 product categories, sizes, 80+ line items
- [x] 11 trades, every title ending in "work" / "কাজ"
- [x] Quote form composing a full WhatsApp message in the reader's language
- [x] Click-to-call and WhatsApp on both numbers
- [x] Google Maps directions from the shop's own CID
- [x] Schema.org `HardwareStore` + `GeneralContractor`
- [x] WCAG AA contrast pass — measured, several colours changed
- [x] GitHub Pages deploy on push, with a page-count assertion
- [x] Client revision rounds: sizes, item renames, categories, hours, address
- [x] 14 delivery areas stated correctly, with a guard against drift
- [x] Logo: navy badge tried and reverted, then the client's high-resolution
      gold badge set in, inset so the circle clip stops shaving the ring
- [x] Google reviews section, hand-filled, no self-serving schema markup

## Phase 1 — Blocked on the user, not on code

- [ ] **Merge `feature/lead-capture-and-trades`** (4 commits)
      One conflict in `build.js`; keep both guard lines:
      `checkAreaCount();` and `checkPhotos();`.
      Brings: 22 trade pages, quote recording, review QR, open-now badge,
      photo pipeline. The site goes from 10 pages to 32.
- [ ] **Set up Firebase** — free Spark plan, **no credit card**. Create the
      project, enable Email/Password sign-in, create Firestore, paste
      `firestore.rules` with your UID in `isOwner()`, then put the project ID in
      `business.json → firebase.projectId`. Full steps in the README.
      Until then every quote request is a WhatsApp message that scrolls away.
      This replaces `tools/quote-alert.gs`, which was never deployed.
- [ ] **Paste real Google reviews** into `content/reviews.json`.
      The section is built and hidden until there is something true in it.

## Phase 2 — Blocked on the client

- [ ] **21 photographs**, of 22. `python3 tools/add-photos.py --status` prints the
      exact filenames to ask for. 3 shop + 7 categories + 11 trades; the owner's
      portrait is already in. Chase by phone, not text.
- [ ] **Google review link** for `reviewUrl` — the `g.page/r/…` short link from
      Google Business Profile → "Get more reviews". A derived write-review URL
      exists (`ChIJ-YGUGHy4VTcRKhXRW-bXFTg`) but has never been tested live.
- [ ] **Domain decision** — the site is on a `github.io` sub-path today.

## Phase 3 — Open, needs a decision

- [ ] **Per-service CTA buttons.** User asked for "alada cta button ar alada
      service section" per service. Partly exists unmerged: each trade page has
      "Request a quote for this work" + WhatsApp. What does **not** exist is a
      CTA on each card in the services listing. Two readings, unresolved:
      (a) a button per card on the listing page, or (b) each service expanded
      into a full section there. **Question was asked, not yet answered.**
      Note: the feature branch wraps each card in `<a class="svc__link">`, so a
      button inside it would nest interactive elements — the card link must be
      unwrapped first.
- [ ] **Per-service WhatsApp message.** Every WhatsApp CTA site-wide currently
      sends the same generic `orderMsg`. A message naming the specific trade
      ("…I need core cutting work…") would convert better and costs one copy key.
- [ ] The three remaining copy decisions: topbar vs hero wording, pickup hours
      placement, week order in the hours table. (The fourth — service title
      wording — was settled on 2026-09-29.)

## Phase 4 — Old branding still shipping

- [ ] **`era-banner.jpg`** — the WhatsApp link preview, still the old logo.
      Highest value of the three: every share of this site happens in WhatsApp.
      Needs redesigning around the new badge, not resizing.
- [ ] `era-logo-180.png` — phone home-screen icon. One line from the same source.
- [ ] `favicon.svg` — a three-bar mark in the old logo's blue/red/amber.

## Not planned

Prices, cart, accounts, blog, CMS, analytics, chat widget. See `PRD.md`.
