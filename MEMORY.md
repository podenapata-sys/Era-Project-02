# Memory

Running context for this project: where it stands, what was decided and why, and
the mistakes already made so they are not repeated. Update this when something
changes that a fresh session would otherwise have to rediscover.

**Last updated:** 2026-09-29

---

## State

| | |
| --- | --- |
| Live branch | `claude/era-project-02-init-zfcj9f` — also the default branch and the deploy trigger |
| Live tip | `086e08e` |
| Live site | 10 pages, 5 per language |
| Unmerged | `feature/lead-capture-and-trades`, 4 commits ahead |
| Repo | `podenapata-sys/Era-Project-02` |

The client is a real shop. Address, phones, hours and map coordinates are their
actual ones and must not be edited without them saying so.

## Origin

The project started from a "PlumbPro" plumbing-service design. The client turned
out to be a **materials supplier and contractor**, not a call-out plumbing
service, so the design was ported and the copy rewritten around supply. Nothing
of the original service-call framing should survive.

## Decisions, and why

**Language is a URL, not a toggle.** The source design switched language in
JavaScript, which gives one indexable page for two languages. Replaced with EN at
root, BN under `/bn/`, `hreflang` + `x-default`. This is the single most
consequential SEO decision in the project.

**Zero dependencies for the site.** No framework, no npm package in the browser,
no lock file. The audience is on cheap Androids on Dhaka mobile data.

**Nothing third-party loads at runtime.** The review QR is generated at build
time and committed rather than drawn by a CDN library — a stalled deferred script
blocks every script behind it.

**Every integration is inert until configured**, and says so at build time.
`quoteEndpoint`, `reviewUrl`, `reviews.items`, `photos/` all no-op cleanly. The
client supplies these over weeks and the site must be correct throughout.

**Guards over vigilance.** Four build-time guards, each added after the failure
it catches actually happened or came one paste away. Each was proved by
deliberately breaking it. See `ARCHITECTURE.md`.

**No review markup in the JSON-LD.** Google disallows self-serving review
markup for `LocalBusiness`. Comments in `build.js` and `README.md` say so, so it
does not get "helpfully" added later.

**Reviews are typed in, not fetched.** Places API needs a Google Cloud project
with a card on file and returns at most 5 reviews. The user chose manual.

## Mistakes made here — do not repeat

- **Address drift.** `business.json` was updated and `copy.json` was not; the
  footer shipped the old address. → guard added, proved by breaking it.
- **"12+" delivery areas** stated beside fourteen named ones. → guard added.
- **Six trade titles lost their "work" suffix** when the copy was written, though
  the client's original list had it on all eleven. Fixed 2026-09-29.
- **Over-applied a correction.** The client said adhesive gum replaces solvent
  cement; it was applied site-wide when they meant the CPVC section only.
  → When a correction points at one section, change one section and ask.
- **Contrast estimated rather than measured** — `#7a8da8` at 3.39:1, stars at
  2.04:1. Fixing `--muted-2` then broke the footer subtitle at 3.07:1.
- **Claimed the deploy workflow could enable Pages.** It cannot —
  `GITHUB_TOKEN` lacks the rights. The README claim had to be corrected.
- **Said "17 photos" repeatedly.** It is 21 distinct subjects across 8 call sites.
- **A `<p>` inside a `<span>`** in the topbar — invalid, browsers tolerate it.
- **Hiding a `<br>`** at a breakpoint produced "PlumbingSolutions".

## Environment gotchas

- **This sandbox cannot reach `github.io` or `google.com`** — the egress proxy
  returns 403. The live site has never been loaded from here. Every claim about
  the deployed result comes from the Actions run and local rendering. Say so
  rather than implying otherwise.
- Playwright's Node binding is not installed; the Python one works against
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- `scroll-behavior: smooth` blanks automated screenshots — disable it in the
  harness, not in the site.
- LibreOffice is broken in this container; it cannot render `.docx`.
- The auto-mode classifier has blocked `git merge` here. The merge is the user's
  to perform.

## Client-facing facts, as confirmed

- Trading since **September 2003**
- **5/1, West Hazipara (Chowdhury Para), D.I.T Road, Rampura, Dhaka-1219**
- **01711-954094** (primary) and **01611-954094**, both on WhatsApp
- **erasanitary2003@gmail.com**
- Open **7 days, 07:00–22:00**, brief Friday close for Jummah
- Delivery until 21:00, pick-up until 20:00, online orders 24h
- **14** delivery areas, named
- Google CID **4041373625017767210**
- Trade #10 is **Thai Glass work**, not "High glass" (corrected 2026-09-29)
- Pressure PVC-U correctly lists **Adhesive gum** (confirmed by the client)

## Working style the user expects

Banglish instructions, terse. They want action and a ruthless read on what
actually makes money — merge, photos, quote endpoint, in that order. They check
work and correct it, so state what was verified and how, and never claim a
measurement that was not taken.
