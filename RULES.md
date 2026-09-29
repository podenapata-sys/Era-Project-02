# Rules

Rules for anyone — human or AI — working on this repository. The hard rules
exist because this is a real shop with a real address and a real phone number.
A mistake here is not a bug report, it is a customer sent to the wrong street.

## Hard rules — never break these

**1. Never invent a fact about the business.**
No fabricated reviews, ratings, customer counts, years in business, brand names,
certifications, guarantees, awards or prices. If it is not in `content/`, in the
client's own words, or on their Google listing, it does not go on the site. This
has come up repeatedly and the answer is always the same: leave it out.

**2. Never invent copy in Bengali or English to fill a gap.**
An empty section is omitted. A missing photo renders as a labelled placeholder.
Neither is a problem; a plausible-looking lie is.

**3. Never put a secret in client-side JavaScript.**
Anything the browser holds is readable by anyone who opens the page source. A
"secret token" there is not a secret. The quote endpoint defends itself with a
honeypot, length caps and per-phone rate limiting instead.

**4. Never change the address, phone numbers, map coordinates or opening hours**
without the client saying so explicitly. These are in `content/business.json`
and mirrored in `copy.json`; change both, in both languages, or the build guard
stops you — which is the point.

**5. No third-party script on the site.** Not for analytics, not for chat
widgets, not for QR codes, not for review embeds. A deferred script that stalls
blocks every script behind it, and on Dhaka mobile data that is when it happens.
Generate at build time and commit the output instead.

**6. No `aggregateRating` or `review` markup in the JSON-LD.** Google's
structured data policy disallows self-serving review markup — a business marking
up reviews of itself, on its own site — and `LocalBusiness` is the case it names.
It looks like a free win and risks a manual action.

## Dependencies

**The website itself has zero dependencies and will keep them.** No npm package
ships to the browser or is needed to build the site. `package.json` exists for
the `build` script and nothing else; there is no lock file because there is
nothing to lock.

Build-time-only tools in `tools/` may use a library (Pillow, segno) because they
are run by hand, occasionally, and their output is committed. Adding one to the
*site* needs a better reason than convenience.

## Code standards

- **Match the surrounding code.** It is dense, comment-heavy where the reason is
  not obvious, and plain where it is. Do not introduce a different idiom.
- **Comments explain why, not what.** `build.js` is full of comments recording
  why something is the way it is — the address that drifted, the word-join bug,
  the invalid `<p>` inside a `<span>`. Keep that habit; it is what makes the file
  maintainable by someone who was not here.
- **Escape everything.** `esc()` for text, `attr()` for attribute values. Content
  is client-supplied and contains `&`, quotes and Bengali punctuation.
- **Both languages, always.** A new copy key goes into `en` and `bn` together.
  Parity is currently 80 keys each.
- **No hardcoded strings in `build.js`.** Anything a visitor reads lives in
  `copy.json`. Month names are the one exception, and they are commented as such.

## Accessibility — not optional

- Text contrast ≥ 4.5:1, non-text and UI boundaries ≥ 3:1 (WCAG 1.4.11).
  **Measure it, do not estimate it.** Several colours in this repo were changed
  after measurement showed 3.39:1 and 2.04:1.
- Never let colour or shape alone carry meaning. The star rating prints the
  number beside it.
- Interactive elements get a real accessible name. Icon-only controls get a label.
- Never nest interactive elements — no button inside a link.
- The page must be usable with JavaScript off. The open-now badge stays hidden
  rather than asserting a state nobody checked.

## Git

- Work on the designated branch. **Never push to `main`, never force-push, and
  never rewrite history on a branch someone else may have checked out.**
- Merging `feature/lead-capture-and-trades` is the user's decision, not the
  agent's.
- Commit messages explain the reasoning, not just the change. Say what was
  verified and how.
- Never commit test fixtures, sample data or generated `dist/` output.

## Before you push

1. `node build.js` — it must succeed and produce the expected page count
2. Diff the output against the previous build and account for **every** change
3. If you claim a contrast ratio, a file size or a count, measure it first
4. If you added a guard, prove it by deliberately breaking it

Claiming something works without checking is worse than not checking, because it
removes the reader's chance to check for themselves.
