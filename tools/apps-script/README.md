# Alerts and the daily brief (Google Apps Script)

Two scheduled jobs the rest of the stack cannot do:

- **`checkNewLeads()`**, every 10 minutes — a new website quote request is
  appended to a Google Sheet and emailed to the shop.
- **`dailyBrief()`**, every morning — one email with who owes money and what is
  booked for today and tomorrow, each row carrying a tap-to-WhatsApp link.

The dashboard at `/admin/` only tells the owner anything when they open it, and
the free Firebase plan has no Cloud Functions, so **nothing else in this project
can run on a timer**. That is the whole reason this exists, and it is why the
daily brief — not the lead alert — is the part that could not have been built
another way.

## It does not touch the website

The obvious design is to have the quote form post here as well as to Firestore.
That was rejected: it puts a second endpoint into public JavaScript, which this
project deliberately removed once already, and it would only ever see *leads* —
the brief needs **jobs**, so it could never be built that way.

This reads Firestore directly instead. **No page on the site changes, and no
customer-facing page gains a request.** The cost is that alerts arrive on a poll
rather than instantly, because Firestore cannot call a webhook without Cloud
Functions. Ten minutes.

## The credential, and why it is read-only

**A service account bypasses `firestore.rules` completely.** Rules govern client
and public REST traffic; Google-authenticated admin traffic is not filtered by
them. This key is therefore the most powerful credential in the project, so:

- It holds **`roles/datastore.viewer` and nothing wider.**
- **Nothing here ever writes to Firestore.** The "which leads have I handled"
  cursor lives in Script Properties precisely so that read-only is enough.
- **The key never goes in this repository.** `Code.gs` is committed; the
  credential is set in Script Properties, the same split as `firestore.rules`
  being a committed record of something pasted into a console.

`assertReadOnly()` proves it. Run it after setup — it must fail with 403. If it
succeeds, the role is too wide; fix that before trusting the script with a live
key.

## Setup

1. **Service account.** Google Cloud Console → the `era-sanitary` project →
   IAM & Admin → Service Accounts → create one. Grant it **Viewer on Cloud
   Datastore** (`roles/datastore.viewer`) and nothing else. Keys → Add key →
   JSON. Keep that file out of the repository.
2. **Spreadsheet.** Make an empty Google Sheet. Its ID is the long string in the
   URL between `/d/` and `/edit`. The header row is written on first use.
3. **Apps Script project.** script.google.com → New project. Paste `Code.gs`.
   Project Settings → tick "Show appsscript.json", then paste that too — it pins
   the timezone, which matters (below).
4. **Script Properties.** Project Settings → Script Properties:

   | Key | Value |
   | --- | --- |
   | `SA_KEY` | the entire service-account JSON, pasted as one line |
   | `PROJECT_ID` | `era-sanitary` |
   | `ALERT_TO` | `erasanitary2003@gmail.com` |
   | `SHEET_ID` | the spreadsheet ID from step 2 |

   `LAST_LEAD_AT` appears by itself; the script maintains it.
5. **Run `checkNewLeads()` by hand** from the editor and approve the permission
   prompts. Then `dailyBrief()`. Then `assertReadOnly()`.
6. **Run `setupTriggers()` once** to attach both schedules. It is safe to re-run:
   it clears existing triggers first, so you cannot end up with two of each
   quietly sending everything twice.

## Two things that will bite

**Timezone.** `appsscript.json` sets `Asia/Dhaka`. Without it the brief computes
"today" in the wrong day — Dhaka is UTC+6, so a job entered at 01:00 local lands
on the previous date under UTC. The same bug is already guarded against in
`src/admin/app.js`, which builds dates from local components for this reason.

**The money arithmetic is duplicated.** `paidOf_()` and `dueOf_()` here mirror
`paidOf()` and `dueOf()` in `src/admin/app.js`: paid is the sum of the payments
log, due is total minus paid, rounded at every boundary. **Change one and you
must change the other**, or the email and the dashboard will disagree about what
a customer owes — which is worse than sending no email. Each file names the
other in a comment.

## The cursor

`LAST_LEAD_AT` advances **only after** the sheet append and the send have both
succeeded. If either throws, the cursor stays put and the lead is picked up on
the next run. Moving it first would lose leads silently, which is the one
failure this must not have.

## Quotas

On a consumer Gmail account, Apps Script allows roughly **100 email recipients a
day** and about **90 minutes of total trigger runtime**. A ten-minute poll is
~144 runs a day at a couple of seconds each — well under both. These numbers
move; check Google's current table rather than trusting this paragraph.

## What it cannot do

**It cannot send WhatsApp messages.** There is no free API. Every link in these
emails is a `wa.me` link with the message already written — one tap to send, but
a person has to tap it. Real automation needs a paid provider and Meta-approved
templates.

## Checking it works

- Submit a real quote request on the live site. Within ten minutes a row should
  appear in the Sheet and an email should arrive, with Bengali text intact.
- **Compare the brief against the dashboard.** The dues in the email and the
  Dues view must name the same customers and the same amounts. Two independent
  implementations agreeing is the only real test that the duplicated arithmetic
  still matches.
- Run `checkNewLeads()` twice in a row — the second run must email nothing.
