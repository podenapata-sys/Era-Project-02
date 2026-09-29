# PRD — ERA Sanitary & Plumbing Solutions

## The problem

ERA Sanitary is a real shop at 5/1, West Hazipara (Chowdhury Para), D.I.T Road,
Rampura, Dhaka-1219, trading since September 2003. It has a Google listing and
two phone numbers, and that is the whole of its online presence.

Two things follow from that. A contractor searching "কোর কাটিং ঢাকা" or "CPVC
fittings Rampura" finds competitors instead. And every order arrives as a phone
call or a WhatsApp message that scrolls out of the chat history within a week,
so nothing is recorded and repeat customers start from scratch each time.

## Who it is for

**Primary — contractors and site foremen.** Buying in volume, want to know the
range is on the shelf before crossing Dhaka, and want a price on a written list
today. They arrive with a specification, not a question.

**Secondary — homeowners mid-renovation.** Buying a basin or a set of bathroom
fittings, or looking for someone to do the tiling. They need reassurance that
this is an established shop, not a page that appeared last month.

Both are on cheap Android phones, on mobile data, and both live in WhatsApp.
That single fact drives most of the design decisions in `DESIGN.md`.

## What it has to do

1. **Be found** for what ERA actually sells and does, in both Bengali and
   English, on real indexable URLs — not behind a language toggle.
2. **Prove the range exists** — seven product categories, eighty-plus line items
   with real sizes, so a contractor can see their fitting listed before setting
   out.
3. **Turn a visitor into a message.** Every path ends in a WhatsApp thread or a
   phone call, because that is how this business already works.
4. **Not lose the enquiry.** A quote request should end up somewhere durable,
   not only in a chat that scrolls away.

## Scope — built and live

- Bilingual static site, English at the root and Bengali under `/bn/`, with
  `hreflang` and `x-default` so both are indexed separately
- 7 product categories with sizes and full item lists
- 11 trades listed, each ending in "work" / "কাজ"
- Quote form that composes a complete WhatsApp message in the reader's language
- Click-to-call and click-to-WhatsApp on both numbers
- Google Maps directions from the shop's own listing (CID `4041373625017767210`)
- Schema.org `HardwareStore` + `GeneralContractor` with hours, geo and catalogue
- 14 named delivery areas
- Google reviews section, filled by hand from `content/reviews.json`

## Scope — built, awaiting merge

On `feature/lead-capture-and-trades`, not yet on the live branch:

- One page per trade, 11 × 2 languages, so each trade can rank on its own
- Quote requests recorded to a Google Sheet and emailed, via Apps Script
- Google review QR code, generated at build time as a static SVG
- "Open now / closed" badge driven by Dhaka hours
- Photo pipeline: 21 phone photos in, cropped and compressed site images out

## Explicitly out of scope

- **No prices.** They move weekly and vary by volume. Every path leads to a
  quote instead.
- **No online payment, no cart, no accounts.** This shop sells by conversation.
- **No invented content of any kind** — no fabricated reviews, ratings, customer
  counts, brand names or guarantees. See `RULES.md`; this is a hard rule, not a
  preference.
- **No blog or CMS.** Nobody is going to write posts.

## How success is measured

There is no analytics on the site yet, so these are judged by what reaches the
shop, not by a dashboard:

1. Quote requests arriving with a complete item list rather than "how much?"
2. The trade pages appearing for trade-plus-area searches once merged
3. Enquiries that reference something only the site says — a size, a delivery
   area, a trade

## Still blocked on other people

- **21 photographs** from the client. Every image on the site is a placeholder
  until these arrive; the pipeline to process them is built and waiting.
- **Apps Script deployment** — five minutes, then the URL goes in
  `business.json` and quote capture starts working.
- **Domain decision** — the site is on a `github.io` sub-path today.
