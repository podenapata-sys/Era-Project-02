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
content/copy.json       All copy, en + bn, in parity (94 keys each, enforced)
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
renders empty on that language's pages. `checkCopyParity()` fails the build and
names the missing key, which beats finding it on a Bengali page months later.

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

### Recording the request (Firebase)

A WhatsApp chat scrolls away, so every request is also written to Firestore,
where the dashboard can read it. Firebase's free Spark plan covers this with **no
credit card** — Auth and Firestore are free; only Cloud Functions and Cloud
Storage need a card, and neither is used.

Nothing is loaded onto the page to do it. The form posts one document to the
Firestore REST API with a plain `fetch`, so there is still no third-party script
anywhere on the site. The project ID is not a secret — it is half of a public URL
— and `firestore.rules` is what actually protects the data.

Setup, once:

1. Create a project at console.firebase.google.com
2. **Authentication → Sign-in method →** enable Email/Password
3. **Authentication → Users →** add your own account, then copy its **UID**
4. **Firestore Database → Create**, in production mode
5. Paste `firestore.rules` into **Build → Firestore → Rules**, with your UID in
   the `isOwner()` list first — while that list is empty nobody can read the
   leads, which is the safe way to be wrong
6. Put the project ID into `content/business.json` → `firebase.projectId`, then
   rebuild and push

While `projectId` is empty the build says so and the form behaves exactly as it
did before: WhatsApp opens, nothing is recorded.

### The dashboard

`/admin/` has four views.

**Dues** is the landing screen, because "who owes me money" is the question the
shop actually has. Everyone with an outstanding balance, biggest debt first.
Each row has a **Remind** button that opens WhatsApp with a message naming the
shop, the work and the amount owed, in Bengali, with the figure in Bengali
numerals. That one button is the point of the whole thing: it turns a list of
debts into money collected without typing anything.

**Jobs** is every job, filtered by Today / This week / This month / All or a
single date. Add one, edit it, take a payment against it without retyping the
record, or delete it to the Bin. Search by name, mobile, customer ID or address.
Stat cards across the top give jobs in view, billed, collected and outstanding.

**Leads** is the website quote requests, as before: newest first, tap to call or
WhatsApp, and move each along new → called → quoted → won / lost. **Make job**
turns one into a job in a tap — name, mobile and items carry over, the enquiry
is marked won, and the job keeps a `leadId` pointing back at it.

**Bin** holds deleted jobs for 30 days with Restore beside each one.

Every view has **Export**, which downloads what is on screen as a CSV.

#### How a job is stored

`paid` and `due` are **never stored**. `paid` is the sum of the `payments` log
and `due` is `total - paid`, both computed when drawn. A stored figure that
disagrees with the log it came from is the one bug this makes impossible, and it
is why there is no "recalculate" button anywhere. Amounts are rounded at every
boundary, because a run of floating-point additions drifts and a customer's
balance must never read 6999.999999999999.

The customer ID (`ER-4094`) is the last four digits of the mobile. It is a handle
for the owner to say out loud, not a key — two customers whose numbers end the
same get the same one, which is fine because Firestore's document id is the key.

Deleting is a soft delete: it sets `deletedAt` and the row moves to the Bin. The
owner is doing this one-handed on a phone and a stray tap must not destroy what a
customer owes. The real delete happens on load, to anything that has sat in the
Bin past `dashboard.binDays` — there are no Cloud Functions on the free plan, so
there is nothing else to run it. **A dashboard nobody opens therefore never
purges**, which is acceptable behaviour for a bin. A row whose `deletedAt` cannot
be parsed is left alone rather than treated as ancient.

Dates are built from local components, never `toISOString()`. Dhaka is UTC+6, so
the UTC path stamps a job entered at 01:00 with yesterday's date and then hides
it from Today. "This week" starts Sunday, because Bangladesh works Sunday to
Thursday.

#### The CSV

Two things Excel does had to be worked around, and both matter here. Without a
byte-order mark it reads the file as the system's legacy encoding and every
Bengali name becomes mojibake, so the file starts with one. And it strips the
leading zero from anything that looks like a number, which ruins every
Bangladeshi mobile — so the phone column is written as `="01711954094"`, which
Google Sheets and LibreOffice understand too. Amounts go out as bare numbers
with no currency symbol, so the columns add up; a column of "৳12,000" is text,
and text does not sum.

**Tap the logo at the bottom of any page three times to open it.** The shop owner
reads leads on their phone, where typing a URL is a nuisance and a bookmark gets
lost; the site is already open, so the shortcut lives there. It is the footer
mark and not the header brand because the header one is a link to the home page —
three taps on a link navigates three times and the count never reaches three. The
footer mark is therefore rendered as a plain `<span>`, which costs nothing: the
Pages column beside it already links home.

This is a shortcut, **not a secret**. `/admin/` is a public URL, and anyone who
finds it meets a login box they cannot pass.

This is switched on: `firebase.webConfig` in `content/business.json` holds the
`apiKey`, `authDomain` and `appId` of the Web app registered under **Firebase
Console → Project settings → Your apps**. Those keys are public by design — they
name the project, they do not grant access to it. While `webConfig` is empty the
page shows setup instructions instead of a login box, and the build says so.

**Only those three are copied in.** The console also hands you `storageBucket`,
`messagingSenderId` and `measurementId`. They configure Cloud Storage, Cloud
Messaging and Analytics, none of which is used — and Analytics would mean a
tracking script, which rule 5 forbids. Auth and Firestore need nothing beyond
those three plus `projectId`.

Both panels on the page ship hidden and are unhidden once Firebase reports the
auth state, so a failed SDK load left a header above an empty page —
indistinguishable from the dashboard being broken. The imports are wrapped now
and say *“Could not load Firebase from Google”* instead. On Dhaka mobile data
that is a realistic Tuesday.

Who may read any of it is `isOwner()` in `firestore.rules`, mirrored in
`firebase.ownerUids` for what the page draws. **The rules are the source of
truth**; the build fails if the two lists disagree. The page's own check is a UI
gate only — Firestore refuses a stranger's read whatever the page does.

`leads` and `jobs` are guarded differently and the difference is deliberate. The
public may **create** a lead, because the quote form posts from a page with
nobody signed in; `validLead()` is therefore a real trust boundary and its size
caps are load-bearing. Nothing unauthenticated may touch `jobs` at all — a lead
is a stranger asking for a price, a job is a named customer, their address and
their debt. `validJob()` exists to catch a bug in the dashboard, not an attacker,
which is why it checks the payments list for being a list of sane length rather
than field by field.

The dashboard also refuses to be framed: nothing renders until it has checked it
is not inside someone else's page. GitHub Pages cannot send `X-Frame-Options`
and `frame-ancestors` is not valid in a `<meta>`, so it hides first in CSS and
reveals itself from an inline script. **This is the one page in the site that
needs JavaScript to show anything**, and the only one allowed to.

Firestore's offline cache is on, so the dashboard keeps working on a dead
connection: reads come from the device and writes queue until it is back. The
cost is that the customer list, with addresses and balances, sits in IndexedDB
on that device.

This is the one page that loads a third-party script, and the deploy workflow
fails if `firebasejs` ever appears outside `dist/admin/`. It carries `noindex`,
is excluded from the sitemap and is disallowed in `robots.txt` — none of which
is security, just keeping the back office out of search results.

**After any change to the rules, submit a real request and go and look in
Firestore.** `recordQuote()` swallows its errors on purpose, so that a recording
failure can never cost the customer their WhatsApp conversation — which also
means a rule that is too strict loses leads with nothing shown on screen and
nothing in the console. The dashboard is the opposite: it reports a refused write
on the page, so a rule problem there is loud.

### Standing this up for another shop

Nothing in `src/admin/app.js` is specific to ERA — that is deliberate, and a
literal phone number or currency in there is a bug. To point it at a different
business:

1. Change `content/business.json` and `content/copy.json`. The `dashboard` block
   carries `idPrefix`, `currency`, `numberLocale` and `binDays`; the job-type
   dropdown is generated at build time from the same `categories` and `services`
   the public site renders, so there is no second list to maintain.
2. Create a Firebase project and enable Email/Password, as above.
3. Paste `firestore.rules` with the new owner's UID in `isOwner()`, and put the
   same UID in `firebase.ownerUids`.
4. Copy `apiKey`, `authDomain` and `appId` into `firebase.webConfig`.

The dashboard stays in English whatever the site's languages are. It is one
owner's back office, not something a customer reads, which is also why its
wording lives in `build.js` rather than `copy.json` — the one exception to that
rule. The payment reminder is the exception to the exception: a **customer**
reads it, so it is `duesReminder` in `copy.json`, in both languages.

## Google reviews

`content/reviews.json` holds real Google reviews, **copied in by hand**. Nothing
is fetched: the Places API needs a Google Cloud project with a card on file, and
returns at most five reviews anyway, so for a shop this size typing them in is
the cheaper and more honest option.

To add one: open the Google listing, copy the reviewer's name, their stars, the
date and their words into `items`, update `rating` and `count` to whatever Google
now shows, then `node build.js` and push. Copy what they wrote **exactly** —
don't tidy it and don't translate it. A review written in Bengali stays in
Bengali on the English page too, because that is what the customer said, and a
reader can tell the difference between a real review and a rewritten one.

The build refuses to run on a malformed entry — a rating outside 1–5, a date
that isn't `YYYY-MM-DD`, an empty name or empty text, or a `count` lower than the
number of reviews listed. A typo stops the site rather than shipping a broken
card on the one section whose whole job is to look trustworthy.

While `items` is empty the section is left out of every page. There is no
placeholder and no example review anywhere in the output.

**These are deliberately not in the JSON-LD.** Google's structured data policy
disallows self-serving review markup — a business marking up reviews of itself,
on its own site — and `LocalBusiness` is the case it names. Adding
`aggregateRating` would look like an SEO win and risks a manual action instead.
The reviews are there for people reading the page.

## Photography — the one thing still outstanding

Twenty-two photographs cover the site: three of the shop, one of the owner, one
per product category, one per trade. The owner's portrait has arrived; the other
twenty-one have not. Until each one arrives its slot renders as a labelled
placeholder. Those are **not** broken images — they are the right size and shape
for the photo that belongs there, so a half-delivered set still looks deliberate.

Nothing in `build.js` needs editing. Drop the files in and run one command:

```sh
mkdir photos-inbox                            # once
python3 tools/add-photos.py --status          # what is missing, by filename
# ... put the photographs in photos-inbox/, named as --status lists them
pip install pillow
python3 tools/add-photos.py                   # cut, compress, strip EXIF
node build.js
```

`--status` prints the exact filenames it wants. Send that list to the client:
naming the files before sending beats renaming twenty afterwards. Partial
deliveries are fine — run it as often as photos turn up, and each one appears on
the site while the rest keep their placeholders.

The script cuts every photo to each shape it is needed at (a category photo is a
card on two pages and a taller block on a third), writes WebP at two or three
widths plus a JPEG fallback, and **strips EXIF on the way out** — phone photos
carry GPS coordinates, and those should not be published as a side effect of
sending a picture. It also applies the EXIF rotation flag before cropping, which
is what stops photos shot in portrait from going up sideways.

Alt text lives in `content/photos.json`. Only the three shop photos need an
entry; a category or trade photo describes itself with its title from
`copy.json`, in whichever language the page is in. Add a key there to say
something better, or to move the crop with `"focus": [x, y]`.

Phone photos in daylight are fine. Shot straight-on, in focus, no flash. Photos
of work already done are better than anything staged.

## The company profile

A bilingual A4 PDF for the client to send to contractors, developers and
procurement people — the document a supplier hands over when someone asks who
they are.

```sh
pip install playwright
python3 tools/build-profile.py        # writes era-company-profile.pdf
```

Fourteen pages: seven in English, then the same seven in Bengali. Cover, who we
are, the full supply catalogue, every trade, delivery areas with hours and
payments, and a contact page. It reads `content/business.json` and
`content/copy.json`, so it regenerates rather than drifting from the site — and
it is **gitignored**, because a committed PDF starts lying the moment the
content changes.

**Nothing in it is invented.** No customer counts, no ratings, no client list,
no certifications, no prices — rule 1 applies here harder than anywhere, because
a company profile is exactly the document that invites "20+ years of excellence
and 1000+ satisfied clients". The one thing deliberately left blank is the
registration block: **Trade Licence No., TIN and BIN/VAT**. Dhaka procurement
departments look for those three and they have to come from the client. The
block is laid out and ruled so it can be filled in by hand, or added to
`business.json` and rebuilt.

### Why a browser and not a PDF library

Bengali needs real text shaping. Its conjuncts, its reph and its vowel signs
that draw to the *left* of the consonant they follow are not glyph-after-glyph
work, and a library that lays out runs by hand gets them subtly wrong — wrong in
a way an English reader proof-reading the file would never catch. Chromium
already has HarfBuzz, so it does the shaping and the script only writes HTML.

For the same reason, **do not verify the output with `pdftotext`.** It extracts
in visual order, so those pre-base vowel signs come back reordered and every
Bengali string fails to match its source. The script checks the markup instead,
which is the exact comparison, and measures each page in the browser for
overflow — a `.page` is a fixed 297mm box, so anything past it is silently not
printed, and one more category in `content/` is enough to do it. Both guards
fail the build and name what broke.

### Colours

Sampled from the client's own badge, not guessed: gold `#E4B40C`, blue
`#0090E4`, red `#F0000C`. The page is white and headings are blue, because the
gold measures 1.94:1 against white and is unusable as text — it appears only as
rules and accents. Large headings use the badge blue at 3.44:1 (AA for large
text); anything smaller uses `#0074B8` at 5.01:1.

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

Bengali sets `lang="bn"` and renders in Noto Sans Bengali; phone numbers use Bengali
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
