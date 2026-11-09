# Payments

One product: a **premium template**, bought once for **2,000 ֏**. A bought template is its
buyer's for good: every list they have or make in it prints clean (no "made with" line),
edited and downloaded without limit. Another template is bought separately — buying one never
opens the others, which is what stops an agency paying once and printing every template.

Free, for anyone: building any list in any template, previewing it, and printing it in the
free template (`memorial`, “Classic” in the interface) with the "made with" line on each page.
Price: `server/src/services/pricing.ts` (charged) and `src/constants/pricing.ts` (printed),
pinned equal by `tests/unit/server/twins.spec.ts`.

Neither building nor buying needs an account.

## The licence

There is no licence table: a `succeeded` `Payment` row **is** the licence, keyed to its owner
(`userId`, or `guestKeyHash` for a guest) and `templateId`. `ownedTemplateIds` in
`server/src/services/payments.ts` reads them; `GET /purchases` answers them to the web.
A list prints clean when its owner holds its template (`printTermsFor`, asked by both PDF
routes); `printTerms` in `services/entitlement.ts` is the pure rule.

A list in a bought template **keeps that template**: the editor's Template step drops the
template grid for a note (`BoughtTemplate` in `TemplatePanel.tsx`) and keeps only the shape
picker. Colours, fonts, table style and layout stay editable. Another template means a new
list ("New list in this template" / "Other templates" from that note). This is interface, not
security: switching a list to a template not bought would only make it unprintable again.

On the templates gallery, each template's page and the dashboard, a bought template carries a
"Bought" badge, and its page says that a new list in it prints without limits — all
client-side (`useOwnedTemplates`), since those pages are static.

## Flow

1. Editor → **Download PDF**, list in a premium template not bought → `CheckoutModal`
   (also opened by `?checkout=1`: from the dashboard's Download, or back from signing in to buy).
   It says the list will keep its template, and offers the free template instead.
2. **Pay** → the list is saved → `POST /purchases/checkout { templateId, listId? }` →
   `startCheckout` writes a `pending` `Payment` and returns the gateway's page URL.
3. The buyer pays on the bank's page; the bank redirects to `GET /payments/return/<gateway>`.
4. That route calls `settlePayment`, which asks the gateway **server to server** and moves the
   row `pending → succeeded|failed` by compare-and-set. Then it redirects to the web's
   `/payment/result?status=…&template=…&list=…&payment=…`, which re-reads the bought templates
   (polling while the bank is still pending) and leads back to the list, or to a new list in
   the template.
5. Both PDF routes (`GET /lists/:id/pdf`, and `POST /pdf` for a guest's local draft, which
   reads the session or guest cookie) answer 402 for a premium template not bought — and again
   after a refund (below).

A buyer who closes the tab before step 3 is covered by **reconcile-on-read**: `GET /purchases`
and every print of a premium template not (yet) owned re-check the owner's pending payments
from the last 3 days. `Payment` rows outlive their list and user (`SetNull`) — they are the
accounting record.

## Without an account

A guest who pays is warned first, in the dialog (`GuestWarning` in `CheckoutModal`): the
template will belong to this browser only — not other devices, and gone if its cookies are
cleared — unless they sign in, which the warning also offers (`SignInToBuyModal`, back to the
same list with `?checkout=1`; a draft keeps the query through its import). Going ahead:

1. `POST /purchases/checkout` without a session mints the browser's **guest key**
   (`server/src/lib/guest.ts`), which owns the payment (`Payment.guestKeyHash`). The guest's
   list can stay a local draft: `POST /pdf` prints a draft clean when the browser's guest key
   owns its template.
2. Signing in — password, Google, or simply `GET /identity/me` with both cookies — moves the
   guest's lists **and payments** to the account and clears the cookie
   (`server/src/services/guestLists.ts`).

## Gateways (`server/src/services/gateways/`)

Copied unchanged from cv-builder. A gateway implements `init`, `check` and `isReversed`
(`types.ts`); `PAYMENT_GATEWAY` picks one.

### `mock` (development)

A page served by the API with Pay / Decline buttons; state in memory. Refused in production
(`isPaymentConfigured`). The seed gives `ani@guests.local` the `ivory` template
(`docs/DEV_CREDS.md`).

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

A refund takes the template back: before printing a bought template, `printTermsFor` re-reads
the owner's `succeeded` payments for it (`revalidateLicence`). One the bank shows refunded or
voided — `OrderStatus` 4 / 3, or `RefundedAmount` reaching the charge; a partial refund does
not count — becomes `refunded`, and the template is no longer the owner's once no `succeeded`
payment for it is left, so they get 402 and may buy it again. A bank that cannot answer counts
as still paid. Until that first print attempt, the badges still show it as bought.

## Delivery evidence

The refund policy (`src/constants/legal.ts#REFUND`) refunds a template that could not be
downloaded in — but not one that was. Every clean PDF the server sends in full writes a
`PdfDownload` row (both PDF routes, `services/downloads.ts`): the time, the size, the IP and
user agent, the template, the list (null for a guest's draft) and the `succeeded` payment it
was served under (the latest, if there are two). It is written on the response's `finish` — the
last byte handed to the connection — so a print that failed, or a client that hung up first,
leaves no row. Free-template PDFs are not recorded.

Rows outlive the list and the account (both links `SET NULL`), like the payment itself. To
check a claim, find the payment by the buyer's email and date, then:

```sql
SELECT d."createdAt", d."templateId", d.bytes, d.ip, d."userAgent"
FROM "PdfDownload" d JOIN "Payment" p ON p.id = d."paymentId"
WHERE p."orderNumber" = <order number>
ORDER BY d."createdAt";
```

No rows: no PDF in that template ever reached them. Rows from their usual IP and browser after
the payment: it did.
