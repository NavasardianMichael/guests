# Payments

One product: **full access** — an access pass of **21 days** for **2,000 ֏**. While it runs,
its buyer prints everything: every template, every kind (seating board, list, place cards,
hall plan), every list they have or make, clean (no "made with" line), edited and downloaded
without limit. A pass bought while one is still running **adds its 21 days on top** of it.

Free, for anyone: building any list in any template, previewing it, and printing it in the
free template (`memorial`, “Classic” in the interface) with the "made with" line on each page.

When a pass runs out **nothing is deleted**: the lists stay, editable, previewable and printable
in the free template. Only what has gone **unused for a year** is removed (below, Retention).

Numbers: `server/src/services/pricing.ts` (`PASS_PRICE_AMD`, `PASS_DAYS` — charged and
enforced), `server/src/services/retention.ts` (`RETENTION_DAYS`) and their web twins in
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
2. **Pay** → the list is saved → `POST /purchases/checkout { listId? }` → `startCheckout`
   writes a `pending` `Payment` and returns the gateway's page URL.
3. The buyer pays on the bank's page; the bank redirects to `GET /payments/return/<gateway>`.
4. That route calls `settlePayment`, which asks the gateway **server to server** and moves the
   row `pending → succeeded|failed` by compare-and-set (setting `paidAt`, where the days start).
   Then it redirects to the web's `/payment/result?status=…&list=…&payment=…`, which re-reads
   that payment through `GET /purchases?payment=` (polling while the bank is still pending)
   and leads back to the list, or to a new one.
5. Both PDF routes (`GET /lists/:id/pdf`, and `POST /pdf` for a guest's local draft, which
   reads the session or guest cookie) answer 402 for a premium template without a running pass
   — including after it ran out, or after a refund (below).

A buyer who closes the tab before step 3 is covered by **reconcile-on-read**: `GET /purchases`
and every print re-check the owner's pending payments from the last 3 days. `Payment` rows
outlive their list and user (`SetNull`) — they are the accounting record.

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

- an account whose session has not been used for `RETENTION_DAYS` (365) is deleted with its
  lists. `User.lastActiveAt` is stamped by `middleware/auth.ts` on any request with a valid
  session, at most once a day;
- a guest's list (owned by a guest key) not changed for 365 days is deleted — a guest leaves
  no other trace;
- `Payment` and `PdfDownload` rows stay (their links `SET NULL`): the accounting record.

A browser's local draft is the browser's; the server never sees it.

## Gateways (`server/src/services/gateways/`)

Copied unchanged from cv-builder. A gateway implements `init`, `check` and `isReversed`
(`types.ts`); `PAYMENT_GATEWAY` picks one.

### `mock` (development)

A page served by the API with Pay / Decline buttons; state in memory. Refused in production
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
`failed`; anything else stays `pending`.

A two-stage terminal answers `OrderStatus 1` / `payment_approved` instead: the amount is
only blocked. After the same OrderID and (blocked) amount checks, `check` sends
`ConfirmPayment` for our amount and reads `GetPaymentDetails` again; only that second read
can settle it. Whether the terminal is one- or two-stage is the bank's setting.

Refunds are made by hand in the bank's merchant panel. `RefundPayment` and `CancelPayment`
exist in the protocol and need the bank's refund/reverse permission; they are not called.

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
a print that failed, or a client that hung up first, leaves no row. PDFs printed without a pass
are not recorded.

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
