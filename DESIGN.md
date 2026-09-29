# Design system

Dark ground, amber accent, one stylesheet, no framework. Every token is a CSS
custom property at the top of `src/assets/css/styles.css`; that block is the
single source of truth and this file describes it.

## Colour

```
--bg        #0b0b0d   page ground
--bg-2      #0e0f12   alternate band, footer
--surface   #141519   cards
--surface-2 #16171b   raised
--line      #22242a   decorative dividers
--line-2    #2a2c33   decorative borders
--line-ui   #6b6e78   interactive boundaries — 3.75:1 on --bg, meets 1.4.11
--text      #f3f3f4   body
--muted     #c9cbd2   secondary
--muted-2   #a7a9b2   tertiary — 8.0:1 on --bg
--amber     #f7b500   accent, CTAs, the topbar
--amber-hi  #ffcb2e   hover
--star      #f7b500   filled stars — 10.1:1 on --surface
--ink       #151515   text on amber
```

Note what the comments carry: **the measured ratio**, not an intention. Several
of these were changed after measurement. `--muted-2` was `#7a8da8` at 3.39:1 and
failed. Stars were 2.04:1 on the original light ground. The footer brand subtitle
broke when `--muted-2` was fixed and had to be repointed separately.

**Rule: measure, do not estimate.** A colour that looks fine on a laptop in a
dark room is not evidence.

**The logo is black-on-transparent**, drawn for this dark ground, and is used at
44px in the header and footer with `border-radius: 50%`.

A navy badge version was tried and reverted at the client's request. Worth
recording why it needed work rather than a straight swap: its navy `#031c48`
sits at **1.18:1** against `--bg`, so the disc was invisible on the header and
had to be set in a white ring to read at all. Any future logo on a light
background will hit the same problem — measure it against `--bg` before
assuming it can be dropped in.

## Type

```
--font-display  "Archivo", "Hind Siliguri", system-ui, sans-serif
--font-body     "Barlow", "Hind Siliguri", system-ui, sans-serif
```

Hind Siliguri is listed **after** the Latin face in both stacks, so each script
falls to the right face without any per-language CSS. Bengali text gets Hind
Siliguri; Latin text gets Archivo or Barlow; a mixed string gets both, correctly.

Headings use display at 700–800 with `-0.015em` tracking and `1.12` line height.
Body is Barlow at 16px on mobile. Small caps-style labels (section eyebrows, the
footer column heads) are display, 12px, `.16em` tracking, uppercase.

Bengali does not use uppercase or letter-spacing — it has no case, and tracking
breaks conjuncts. Where a label is uppercase in English it stays sentence case in
Bengali.

## Numerals

The Bengali pages use Bengali digits: ২০০৩, ১৪, ৪.৮. Any number rendered from
data must be converted (`num(value, lang)` in `build.js`), or it sits as ASCII
next to Bengali digits on the same page and reads as a bug. This applies to
`aria-label` too — a screen reader on the Bengali page should not say "4.8".

## Spacing and shape

```
--shell      1200px    content width
--section-y  clamp(52px, 6.5vw, 92px)
--r-sm  8px   --r  12px   --r-lg  18px
```

Section padding, gaps and type scale use `clamp()` throughout, so there is one
continuous response rather than jumps at breakpoints. Breakpoints that do exist:
1024px (nav collapses, grids narrow), 760px (single column), 520px (tightest).

## Components

**Buttons.** `.btn--accent` is amber on `--ink` — one per view, the primary
action. `.btn--ghost` is bordered, for the secondary. WhatsApp actions are always
accent, because that is the conversion path.

**Cards.** `--surface` on a `--line` border at `--r`. Product cards, trade cards
and review cards share the geometry so a page of mixed cards reads as one grid.

**Photo slots.** Where a photograph is missing, a dashed box with the subject
labelled, at the exact aspect ratio of the real image. It looks deliberate, does
not shift when the photo lands, and makes a half-delivered set look intentional.
Ratios: hero 4:3, why/about 5:4, category card 16:9, category block and trade
card 4:3, trade hero 16:10.

**Stars.** Filled `--star` at 10:1, empty `--line-ui` at 3.6:1. The row is one
labelled image to a screen reader, and the number is always printed beside it.

## Non-negotiables

1. **Contrast is measured.** 4.5:1 text, 3:1 non-text and UI boundaries.
2. **Colour never carries meaning alone.**
3. **No layout shift.** Every image has `width`/`height` or an `aspect-ratio`.
4. **No horizontal scroll at 390px.** Checked, not assumed.
5. **Works with JavaScript off.** Nothing essential is JS-only.
6. **`[hidden]` must stay `display: none !important`** — it backs the open-now
   badge, which renders hidden and is filled by script.

## Things that have already gone wrong here

Kept because they will otherwise be repeated:

- Hiding a `<br>` at a breakpoint joined two words into "PlumbingSolutions".
  Whitespace before each `<br>`.
- A `<p>` inside a `<span>` in the topbar — tolerated by browsers, invalid, and
  flagged by a validator.
- `scroll-behavior: smooth` made automated screenshots come out blank. The site
  was fine; the tooling had to disable it.
