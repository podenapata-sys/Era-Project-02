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

## The two halves go live at different times

**This does not wait for `firestore.rules` to be published.** A service account
bypasses rules completely, which is the same fact that makes the credential
dangerous — here it means the script works regardless. So:

- **`checkNewLeads()` works from the moment it is set up.** The public quote
  form already writes to `leads`, rules or no rules.
- **`dailyBrief()` sends nothing until jobs exist**, and a job cannot be created
  until the rules are published and the owner saves one at `/admin/`. It returns
  early when there is nothing to report, so this is silence, not an error. Do
  not read an empty morning as a broken script.

Set it up whenever; the brief starts speaking once there is something to say.

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

## Sign in as the shop before you start

`MailApp` sends **from the Google account that owns the script**, and on a
consumer account that address cannot be overridden in code. Create the Apps
Script project while signed in as **`erasanitary2003@gmail.com`**, not a
personal account — otherwise every alert arrives from the wrong address and the
daily sending quota is spent on the wrong account. Moving it afterwards means
making the project again.

The display name is set to the business, so the mail reads as from
"ERA Sanitary & Plumbing Solutions" rather than a bare address.

### Use an incognito window — this went wrong once already

Reading the paragraph above is not enough, and we know because it was read and
the project still landed on the wrong account. **The cause is Google's
multi-account handling, not carelessness.** If the browser is signed into more
than one Google account, `script.google.com` quietly opens under whichever one
is "default", and the only tell is a `/u/0/` or `/u/1/` buried in the URL. The
avatar in the corner is easy to miss and easy to misread.

So do not rely on noticing it:

1. Open an **incognito or private window**.
2. Sign in there as **`erasanitary2003@gmail.com` and nothing else**. With one
   account signed in, there is no default to get wrong.
3. Create the project, then — **before pasting anything** — open
   **⚙ Project Settings** and check the owner line reads the shop's address.
   That is the definitive check; the avatar is not.

If it is wrong, delete the project (Project Settings → Delete project) and start
again in a clean incognito window. There is no transfer that fixes the sending
address, because `MailApp` follows the owner.

**The service account is not affected by this.** It belongs to the
`era-sanitary` Google Cloud *project*, not to whoever created it, so a service
account made from the wrong signed-in account is still fine and does not need
redoing.

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

   | Key | Value | |
   | --- | --- | --- |
   | `PROJECT_ID` | `era-sanitary` | type exactly this |
   | `ALERT_TO` | `erasanitary2003@gmail.com` | type exactly this |
   | `SA_KEY` | ⟨the contents of the .json file from step 1⟩ | **not this description** |
   | `SHEET_ID` | ⟨your Sheet's URL, or just its id⟩ | **not this description** |
   | `LEAD_ALERT_TO` | ⟨optional — see below⟩ | **not this description** |

   **The ⟨angle brackets⟩ mean "put the real thing here".** This has already
   caught someone out: the words *"the entire service-account JSON"* got pasted
   into `SA_KEY` verbatim, and the first run failed with
   `SyntaxError: Unexpected token 'h', "the whole s"... is not valid JSON`,
   because `JSON.parse` was handed an English sentence. The top two rows are
   literal; the bottom three are descriptions of something you have to go and
   fetch.

   `SHEET_ID` takes **either the whole Sheet URL or the bare id** — paste
   whichever you have and the script pulls the id out, including from the
   `/spreadsheets/u/1/d/...` form you get when signed into several Google
   accounts. It has to be *your* Sheet: open it, copy from the address bar.

   `SA_KEY` is the **whole file** you downloaded in step 1, braces included —
   it begins `{"type": "service_account"` and runs to the closing `}`. Open the
   .json in a plain text editor, select all, copy, paste. Do not retype it, do
   not drop the braces, and do not run it through an online JSON formatter —
   that is a private key, and pasting it into a website hands it to that
   website.

   **`LEAD_ALERT_TO` exists because the two emails are not equally private.** A
   new enquiry is work for whoever picks it up first, so more eyes help. The
   daily brief is the shop's receivables — every customer who owes money and
   exactly how much — and widening that is a decision, not a convenience. Set
   `LEAD_ALERT_TO` and lead alerts go there instead; the brief always follows
   `ALERT_TO` alone. Leave it unset and both emails go to `ALERT_TO`.

   Either may be a comma-separated list with no spaces, e.g.
   `erasanitary2003@gmail.com,someone@example.com`. Remember the daily quota
   counts **recipients**, not messages, so two addresses consume two.

   `LAST_LEAD_AT` appears by itself; the script maintains it.
5. **Run `checkNewLeads()` by hand** from the editor. Google asks for permission
   the first time, and **the consent screen is where people stop**: it says
   *"Google hasn't verified this app"*. Click **Advanced**, then
   **Go to \<project name\> (unsafe)**. Every personal Apps Script project is
   unverified — verification is for apps distributed to strangers. This is your
   own script in your own account.

   It then asks for four things, which map to the four scopes in
   `appsscript.json`: send mail as you, see and edit your spreadsheets, connect
   to an external service (Firestore), and manage its own triggers.

   Then `assertReadOnly()` — **this one must FAIL with 403.** Then `dailyBrief()`.
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

**Expect the first run to sweep up everything.** `LAST_LEAD_AT` does not exist
yet, so it defaults to `1970-01-01` and the first `checkNewLeads()` picks up
*every* lead in the collection — the whole history goes into the Sheet and
arrives as one email. That is deliberate and it is what this shop wants: the
Sheet starts with the full enquiry record rather than from nothing. The email is
a one-off; delete it.

If a later setup should start from now instead, add `LAST_LEAD_AT` by hand as a
Script Property with a current ISO timestamp (`2026-10-06T12:00:00.000Z`)
*before* the first run. Everything older is then ignored for good.

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
