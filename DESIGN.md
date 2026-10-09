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

**The logo is the gold-and-black badge**, drawn for this dark ground: a black
disc with transparent corners, used at 44px in the header and footer with
`border-radius: 50%`.

Two constraints for any replacement:

**Inset the artwork.** `.logo img` clips a circle out of the square, so a badge
whose ring runs to the frame edge gets shaved. The current asset sits at **96%
of the canvas**, and the clip therefore cuts black rather than gold. The version
before it had this wrong and lost part of its ring at every size.

**Measure it against `--bg` first.** A navy badge was tried and reverted: its
navy `#031c48` sits at **1.18:1** against `--bg`, invisible on the header, and
needed a white ring to read at all. Any logo drawn for a light background will
hit the same wall.

## Type

```
--font-display  "Archivo", "Noto Sans Bengali", system-ui, sans-serif
--font-body     "Barlow", "Noto Sans Bengali", system-ui, sans-serif
```

The Bengali face is listed **after** the Latin face in both stacks, so each
script falls to the right face without any per-language CSS. Bengali text gets
Noto Sans Bengali; Latin text gets Archivo or Barlow; a mixed string gets both,
correctly.

**The faces are served by this site, not by Google.** Five woff2 files in
`src/assets/fonts/`, fetched by `tools/fetch-web-fonts.py`, each scoped by
`unicode-range` so an English page never downloads the Bengali one. Archivo and
Noto Sans Bengali are both variable — one file each, every weight. Barlow ships
at 400 and 700 only, because every 500 and 600 in the stylesheet sits under a
rule that sets `--font-display` and therefore resolves to Archivo.

**Adding a weight to the stylesheet is not enough for a static face** — add it
to `WANT` in that script too, or the browser synthesises it from a weight it
has. That now applies to Barlow alone.

### Noto Sans Bengali replaced Hind Siliguri

The client chose the face. What it bought, measured by loading each page and
recording every woff2 the browser actually requested:

| | before | after |
| --- | --- | --- |
| English page | 149.3 KB | **79.0 KB** |
| Bengali page | 291.7 KB | **183.2 KB** |

Two separate wins. Noto is variable, so one 105.2 KB file does what three static
Hind Siliguri weights did in 213.7 KB. And **the language-switch label stopped
costing 71 KB.**

That label reads `বাং` and is the only Bengali on an English page; drawing it
from the full face pulled the whole thing for three characters, nearly half that
page's font weight. It now has **its own face of 952 bytes**, cut by Google's
`text=` parameter to exactly ব, া and ং — declared as `"Bengali Switch"` and
pointed at by `.langswitch [lang="bn"]`.

Three things about that are worth keeping:

- **It needs a separate family name.** Two `@font-face` rules on one family with
  overlapping `unicode-range` resolve to the last declared, so the full face
  would win and the saving would vanish.
- **`system-ui` does not work here.** It was the obvious first idea — let the
  device draw its own Bengali — but Roboto and Segoe UI contain no Bengali, so
  the browser exhausts the CSS family list and fetches the webfont anyway.
- **The subset is pinned to those three characters.** Change the label and the
  glyphs are simply absent; the text still renders, drawn by whatever the device
  had, and nobody notices. `checkLangSwitchSubset()` in `build.js` holds
  `LANG_LABEL.bn` against the `unicode-range` in the stylesheet and refuses the
  build instead.

Headings use display at 700–800 with `-0.015em` tracking and `1.12` line height.
Body is Barlow at 16px on mobile. Small caps-style labels (section eyebrows, the
footer column heads) are display, 12px, `.16em` tracking, uppercase.

Bengali does not use uppercase or letter-spacing — it has no case, and tracking
breaks conjuncts. Where a label is uppercase in English it stays sentence case in
Bengali.

**That rule is now enforced in CSS, not just written here.** It sat in this file
unimplemented for most of the project: the stylesheet had no Bengali selector at
all, so all eleven letter-spacing rules and all four uppercase rules applied to
Bengali too. Measured on the Bengali home page, **45 elements carried tracking
they should not have** — every heading with *negative* tracking (-0.51px on the
h1, squeezing the conjuncts) and the category labels with +1.4px, pulling them
apart. The `Bengali` block near the end of `styles.css` resets both.

It is scoped two ways: `html[lang="bn"]` for the `/bn/` pages, and a bare
`[lang="bn"]` for the one Bengali string on an English page — the language
switch reads বাং and carries its own `lang`. Specificity, not `!important`.

**Bengali also takes more leading than Latin at the same size.** The matra joins
the letter tops into a continuous line and conjuncts hang below the baseline, so
the 1.6 that suits Barlow is tight for a Bengali face, and the 1.12 set for Latin
display type leaves conjuncts touching the line above. Bengali prose is 1.85 and
Bengali headings 1.35. That costs about 6% page height and is worth it.

Those two numbers were tuned to Hind Siliguri and **were re-measured, not
assumed, when Noto replaced it — and they did not need to move.** Rendering the
same string in both at 100px: the ink above the baseline is within 3–5% (ক 62 vs
64, কা 69 vs 73, ৪ 62 vs 65), so the apparent size barely shifted, and
`line-height` is an explicit multiple of `font-size` rather than of the font's
own box, so it was never reading the metric that did change. Noto also hangs
*less* below the baseline (41 against 50 per 100px), which makes 1.35 on headings
safer than it was, not riskier.

What did change: Noto sets about **8.5% wider** for the same sentence, so Bengali
lines wrap a word earlier. Its conjuncts are the exception and are narrower —
ক্ষ is 85.9 against Hind's 104.2.

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
card 4:3, trade hero 16:10, owner portrait 1:1.

**The owner's portrait is a 120px circle, and the size is the argument.** It is
a formal studio headshot on a plain white background, and that white sits at
roughly **20:1 against `--bg`** — not a contrast failure but a weight problem.
Drawn at card size it is the brightest object on the About page and outweighs
both the shopfront photo beside it and the copy it belongs to. At 120px and
round, the white reads as a deliberate light disc and the eye sees a face, which
is the same move the gold badge already makes at 44px.

Cutting the background out was considered and rejected. Hair against white is
exactly where automatic matting fails, and a halo around the owner's head is
worse than a white circle. The ring is `--line-ui`, already measured at 3.75:1.

The source frame is tight — 44px above the hair, 3% of its height — so
`photos.json` gives this one `focus: [0.5, 0.0]`, taking the square from the top
of the frame. The default `[0.5, 0.42]` would cut 118px off the top and shave
the crown.

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
- **`backdrop-filter` on the header killed the entire mobile menu.** The nav is
  `position: fixed` inside `.site-header`, and `backdrop-filter` makes an
  element the containing block for its fixed descendants — so the menu resolved
  `top`/`bottom` against the 85px header instead of the viewport and rendered
  **43px tall holding 360px of content**. Not one of the five links was
  reachable on a phone. It shipped, it survived several rounds of screenshots,
  and the client found it.

  The general rule, because it is not only `backdrop-filter`: **`filter`,
  `transform`, `perspective`, `will-change` and `contain` on an ancestor all
  silently re-parent a `position: fixed` child.** Any of them on an element
  that wraps fixed content belongs behind `@media (min-width: 1025px)`, where
  the nav is static. There was also no `-webkit-backdrop-filter`, so Safari
  never applied the blur and never broke — it failed only on Chrome/Android,
  which is the audience.

  `tools/check-mobile.py` now opens the menu and asserts nothing is clipped.
  Run it before pushing anything that touches the header or the nav.
