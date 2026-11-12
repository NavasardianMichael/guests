# Payments

One product: **full access** — an access pass of **21 days** for **2,000 ֏**. While it runs,
its buyer prints everything: every template, every kind (seating board, list, place cards,
hall plan), every list they have or make, clean (no "made with" line), edited and downloaded
without limit — and **5 guest lists read from a photo** (below, Photo reading). A pass bought
while one is still running **adds its 21 days on top** of it, and its 5 photo reads.

Free, for anyone: building any list in any template (typed, pasted, Excel / CSV), previewing
it, and printing it in the free template (`memorial`, “Classic” in the interface) with the
"made with" line on each page. Reading a list from a photo is not free.

When a pass runs out **nothing is deleted**: the lists stay, editable, previewable and printable
in the free template. Only what has gone **unused for a year** is removed (below, Retention).

Numbers: `server/src/services/pricing.ts` (`PASS_PRICE_AMD`, `PASS_DAYS` — charged and
enforced), `server/src/services/retention.ts` (`RETENTION_DAYS`),
`server/src/services/photoQuota.ts` (`PHOTO_READS_PER_PASS`) and their web twins in
`src/constants/pricing.ts` (printed), pinned equal by `tests/unit/server/twins.spec.ts`. A
change of either is also a change of the copy that states it: the three message files (the
days are interpolated, but "a year" and the item lists are worded) and the legal pages
(`src/constants/legal.ts`: price and days interpolated, the year worded).

Neither building nor buying needs an account.

## The pass

There is no licence table: the owner's `succeeded` `Payment` rows (`userId`, or
`guestKeyHash` for a guest) **are** the passes. `accessWindow` in
`server/src/services/entitlement.ts` (pure, `tests/unit/server/entitlement.spec.ts`) folds
them by `paidAt`: each adds `PASS_DAYS`, from its payment, or — if a pass was still running
then — from that one's end. It answers `until` (when access ends; in the past once it ran out)
and `chain` (the payments the latest window is made of).

`GET /purchases` answers `{ accessUntil, payment }` to the web (`accessUntil` ISO or null;
`payment` the status of `?payment=<id>` when it is the visitor's). Both PDF routes ask
`printTermsFor` (`services/payments.ts`): a running pass prints any template clean; without
one only the free template prints, with the line. `printTerms` in `services/entitlement.ts` is
the pure rule, `isPrintable` in `src/constants/templates.ts` its web twin.

Any list may be in any template at any time — nothing is locked to what was paid.

## Telling the buyer

The 21 days, and what happens after them, are said wherever money is:

- **Checkout** (`CheckoutModal`): what is included, when the days start and end (`startsNow`,
  or `extendNote` with the new end date while a pass runs), what stays when they end
  (`afterText`), and that unused lists go after a year (`keptText`).
- **Editor**: the top bar's `AccessChip` shows the days left while a pass runs (accent-coloured
  from 3 days; a click opens the checkout to add days); the Template step's hint says either
  what downloading needs or until when everything prints clean.
- **Dashboard** (`AccessBanner`): until when and how many days are left, or — once it ran out —
  that every list is still there and what it can do without a pass. Its subtitle states the
  one-year retention.
- **Payment result**: until when access runs, and what stays after.
- **Pricing page and FAQ**: the plans, "When the 21 days end", and the retention line; the
  terms, privacy (section 7) and refund pages in Armenian.

## Flow

1. Editor → **Download PDF**, list in a premium template without a running pass →
   `CheckoutModal` (also opened by the access chip, by `?checkout=1`: from the dashboard's
   Download, or back from signing in to pay). While no pass runs it also downloads the list in
   the free template, for that file only — the list on screen keeps its template.
2. **Pay** → the list is saved → `POST /purchases/checkout { listId?, client, resume? }`
   (`useCheckout`) → `startCheckout` writes a `pending` `Payment` and returns the gateway's page
   URL (`redirectUrl`). Before that, the route guards against charging one click twice (below).
3. The buyer pays on the bank's page; the bank redirects to `GET /payments/return/<gateway>`.
4. That route marks the payment returned (`returnedAt`) and calls `settlePayment`, which asks
   the gateway **server to server** and moves the row `pending → succeeded|failed` by
   compare-and-set (setting `paidAt`, where the days start). Then it redirects to the web's
   `/payment/result?status=…&list=…&payment=…`, which re-reads that payment through
   `GET /purchases?payment=` and leads back to the list, or to a new one.
5. Both PDF routes (`GET /lists/:id/pdf`, and `POST /pdf` for a guest's local draft, which
   reads the session or guest cookie) answer 402 for a premium template without a running pass
   — including after it ran out, or after a refund (below).

A buyer who closes the tab before step 3 is covered by **reconcile-on-read**: `GET /purchases`,
every print and every new checkout re-check the owner's pending payments from the last 3 days.
`Payment` rows outlive their list and user (`SetNull`) — they are the accounting record.

### The result page says what happened

Fixes found by cv-builder going live on Ameria's terminal:

- **Back with nothing charged** — Back on the bank's page, the 20-minute limit, the bank page's
  own error (0999): the bank's record still says `payment_started` (0) or
  `payment_autoauthorized` (5), so `check` answers `pending` with `nothingCharged`, and
  `settlePayment` returns `unpaid`. The return route shows that as **failed — nothing
  charged**, not an endless "processing"; the row stays `pending`, so a payment made after
  all still counts on the next read. Only a redirect that itself says `resposneCode=00` (the
  bank's spelling) waits for the record to catch up.
- **Processing** polls 8 × 4 s; when it stops it says so (`unconfirmed`): no need to wait,
  access opens by itself if the card was charged, nothing to do if not.
- **Try again** on a failure starts a new payment from the result page, straight to the
  bank's page (`useCheckout`) — the buyer saw the price and terms moments ago. Never offered
  while pending: the first payment may yet be charged.
- The description sent to the bank is **Latin** (`Guest lists: full access for 21 days, order
  #N`): Ameria stores it without Unicode, and Armenian reached its panel as "¿¿¿".

### One click is charged once

`POST /purchases/checkout` answers something other than a bank page in two cases:

- **An earlier payment went through** (409 `earlierPaymentSucceeded`): reconcile found that a
  payment whose redirect never arrived was charged. The dialog closes, says until when access
  runs, and downloads the list as designed — the buyer is not sent to pay again.
- **An earlier bank page may still be open** (`{ openPayment: { minutesAgo } }`): a payment of
  this owner's that is `pending`, never returned from (`returnedAt` null) and younger than the
  page timeout + 2 minutes (`PAYMENT_PAGE_TIMEOUT_SECONDS`, 1200 s, sent to the bank as
  `Timeout`). The buyer is asked to continue that same order (`Payment.openPayment` copy); on
  yes the web resends with `resume: true` and is sent to **that order's** bank page
  (`gateway.pageUrl`), so whichever tab they pay in, one order is charged once. Resumed only
  once (`reopenedAt`, claimed by compare-and-set): back again without the bank sending them,
  that page may not reopen, and the next click starts a new order — never a loop. Both
  timestamps are the server's clock.

A deliberate second payment is never undone: its days go on top (`accessWindow`).

### Admin mails

`services/paymentNotifications.ts` (facts from the database) and `paymentMail.ts` (the mail,
pure, tested in `paymentMail.spec.ts`) tell the admin inbox, through the mail engine's internal
endpoint, when a buyer clicks Pay ("Checkout started", or "FAILED to start" when the gateway
refused) and when a payment settles ("Payment succeeded", sent once by whichever settler won
the claim, naming which: the bank's redirect, an access read, a print, or another checkout).
Each lists the payment, the buyer (account or guest, how many lists, paid before), the list it
started from, until when access runs, and the device: the request's IP, user agent, client
hints, and what the browser reports with the checkout (`src/helpers/clientInfo.ts`, whitelisted
and bounded by `server/src/lib/request-info.ts`; never used for a decision). Visitor text goes
only in the body and details, which the engine escapes. Best effort and fire-and-forget: a
failure is logged, never shown to the buyer. Sent **only in production**; elsewhere the mail is
printed to the API console. "Started" mails are capped at 30 an hour.

## Photo reading

Reading a guest list from a photo (Gemini, `services/guestReader.ts`) costs a model request,
so it comes with full access only, and is counted (`services/photoQuota.ts`, pure, tested in
`photoQuota.spec.ts`):

- **Free users: none.** Without a running pass `POST /ai/extract-guests` answers 402
  `photoNeedsAccess`.
- **With a pass: `PHOTO_READS_PER_PASS` (5) per pass**, counted over the running access
  window — from its first pass's `paidAt`, against 5 × the passes it is made of. Days bought on
  top of a running pass bring 5 more; a new pass after one ran out starts a fresh count. Spent:
  429 `photoLimitReached`.
- **One photo per request**, and the web sends one at a time (`multiple={false}`; of several
  dropped, the first is read).
- Only a photo that yields names counts: one where none were found, an unreadable answer, or
  our own failure gives the read back.

Each read is a `PhotoRead` row (owner and time — nothing of the photo), claimed **before** the
model is asked and checked against the allowance, so racing requests cannot both take the last
one; deleted again when the read gave nothing. Rows move to the account on sign-in with the
lists and payments (`guestLists.ts`), and are swept after a year. The pass check is
`runningPass` — the same as a clean print: pending payments settled, refunds re-checked.

The web never hides the source (`ImportModal`): `GET /ai/photo` answers `{ state, allowance,
remaining, until }`, and the upload is disabled with the reason — `locked`: "comes with full
access" and a button to the checkout; `used`: until when access runs and an "Add days" button
(new days bring more reads); `available`: how many are left. The rules are printed under the
upload, and the "From a photo" buttons (Guests step, empty canvas) carry a lock while no pass
runs (`PhotoLock`). Pricing, the checkout's list, the FAQ, the terms (§3, §5) and privacy (§3)
say the same.

## Without an account

A guest who pays is warned first, in the dialog (`GuestWarning` in `CheckoutModal`): the
access will belong to this browser only — not other devices, and gone if its cookies are
cleared — unless they sign in, which the warning also offers (`SignInToBuyModal`, back to the
same list with `?checkout=1`; a draft keeps the query through its import). Going ahead:

1. `POST /purchases/checkout` without a session mints the browser's **guest key**
   (`server/src/lib/guest.ts`), which owns the payment (`Payment.guestKeyHash`). The guest's
   list can stay a local draft: `POST /pdf` prints a draft clean while the browser's guest key
   holds a running pass.
2. Signing in — password, Google, or simply `GET /identity/me` with both cookies — moves the
   guest's lists **and payments** to the account and clears the cookie
   (`server/src/services/guestLists.ts`). The account's window is then folded from all of them.

## Retention

`server/src/services/retention.ts` (the policy, pure) and `retentionSweep.ts` (the sweep, run
once a day by the API process, first 10 minutes after start — `src/index.ts`):

- something goes only when it has been **wholly unused** for `RETENTION_DAYS` (365): not used,
  not downloaded, and no pass running at any point of that year (`isUnusedSince`);
- "used" for an account is its session (`User.lastActiveAt`, stamped by `middleware/auth.ts`
  on any request with a valid session, at most once a day); an account goes with its lists;
- "used" for a guest's list (owned by a guest key) is a change to it — a guest leaves no other
  trace — and "downloaded" is any `PdfDownload` of it, the free print included;
- `Payment` and `PdfDownload` rows stay (their links `SET NULL`): the accounting record.

A browser's local draft is the browser's; the server never sees it.

## Gateways (`server/src/services/gateways/`)

Copied unchanged from cv-builder. A gateway implements `init`, `pageUrl`, `check` (reads only),
`confirm` (two-stage terminals), `refund`, `cancel` and `isReversed` (`types.ts`);
`PAYMENT_GATEWAY` picks one.

### `mock` (development)

A page served by the API with Pay / Decline buttons; state in memory. A mock page left
unanswered stays `pending`, which is how the "continue the open payment" prompt is tried
locally. Refused in production
(`isPaymentConfigured`). The seed gives `ani@guests.local` a running pass and
`gor@guests.local` one that ran out (`docs/DEV_CREDS.md`).

### `ameria` — Ameriabank vPOS 3.1

Wire format and the settlement rule: `ameria-wire.ts` (pure, tested in
`tests/unit/server/ameria.spec.ts`). The client: `ameria.ts`, the only reader of the
credentials.

Going live:

1. Apply for vPOS through Ameriabank's business platform; credentials and the test
   environment come from vpos.support@ameriabank.am. The bank requires the Terms, Privacy and
   Refund pages to be reachable on the site (`/terms`, `/privacy`, `/refund-policy` — **their
   text is a draft; have it reviewed**).
2. Test mode (`AMERIA_TEST_MODE=true`, base `servicestest.ameriabank.am`): the test terminal
   accepts only **10 AMD** and an **OrderID inside the range the bank assigns**. Set
   `AMERIA_AMOUNT_OVERRIDE=10` and `AMERIA_ORDER_ID_OFFSET` to the start of the range (the
   OrderID sent is offset + `Payment.orderNumber`). The bank signs off after several
   successful test payments.
3. Production: `AMERIA_TEST_MODE=false`, remove `AMERIA_AMOUNT_OVERRIDE`, set the offset so
   live OrderIDs never collide with test ones, `PAYMENT_GATEWAY=ameria`, and
   `API_PUBLIC_URL` to the public API origin (the BackURL is built on it). All of it goes in
   `ENV_API_BASE64` (`pnpm env:base64 production` warns about what is missing).

What is verified on return: `ResponseCode "00"`, `OrderStatus 2` / `payment_deposited`, the
OrderID equals ours and the charged amount is at least ours. Declined, void and refunded are
`failed`; started (0) or 3-D Secure not authorised (5) are `pending` with nothing charged;
anything else stays plainly `pending`.

A two-stage terminal answers `OrderStatus 1` / `payment_approved` instead: the amount is
only blocked. After the same OrderID and (blocked) amount checks `check` answers `approved`,
and `settlePayment` calls `confirm`: `ConfirmPayment` for our amount, then `GetPaymentDetails`
again; only that second read can settle it. Whether the terminal is one- or two-stage is the
bank's setting.

Refunds are made by hand in the bank's merchant panel. With the bank's reverse/refund
permission and `AMERIA_API_REVERSALS=true`, an operator can also send them through the API:
`pnpm payments:reverse <refund|cancel> <order number>…` (`server/src/cli/reverse-payment.ts`;
CancelPayment only within 72 hours). Without that variable both are refused before any call —
the bank answers 514 / 513 without the permission. Either way the payment becomes `refunded`
and its days leave the window.

A refund takes its days back: before a clean print, `printTermsFor` re-reads the payments of
the running window (`revalidatePass`). One the bank shows refunded or voided — `OrderStatus`
4 / 3, or `RefundedAmount` reaching the charge; a partial refund does not count — becomes
`refunded`, and the window is folded again without it, so the owner may get 402 and may pay
again. A bank that cannot answer counts as still paid. Until that first print attempt, the
editor and dashboard still show the old end date.

## Delivery evidence

The refund policy (`src/constants/legal.ts#REFUND`) refunds a pass under which nothing could
be downloaded — but not one under which something was, and the days running out is no reason.
Every clean PDF the server sends in full writes a `PdfDownload` row (both PDF routes,
`services/downloads.ts`): the time, the size, the IP and user agent, the template, the list
(null for a guest's draft) and the payment it was served under (the latest of the running
window). It is written on the response's `finish` — the last byte handed to the connection — so
a print that failed, or a client that hung up first, leaves no row. A saved list printed
without a pass is recorded too, with no payment — a use that keeps it from the retention sweep;
a guest's draft printed without one is not.

Rows outlive the list and the account (both links `SET NULL`), like the payment itself. To
check a claim, find the payment by the buyer's email and date, then:

```sql
SELECT d."createdAt", d."templateId", d.bytes, d.ip, d."userAgent"
FROM "PdfDownload" d JOIN "Payment" p ON p.id = d."paymentId"
WHERE p."orderNumber" = <order number>
ORDER BY d."createdAt";
```

No rows: no clean PDF was served under that payment. Rows from their usual IP and browser
after the payment: it was. A payment that extended a running pass gets rows only once it is the
latest of the window, so check its predecessor's rows from the same days too.
