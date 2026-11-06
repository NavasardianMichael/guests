# Billing — the plan (not built)

The business model is cv-builder's: building is free and needs no account; the **free
template** (`free: true` in `src/constants/templates.ts` — only `memorial`, called “Classic” /
«Դասական» in the interface) always prints free; printing a list in any **premium template** is a
**one-time payment per list** (`LIST_PRICE_AMD`, 2,000 ֏ — a placeholder to confirm). A paid
list stays printable and editable forever; a duplicate is a new, unpaid list.

Nothing charges yet, but premium templates are already refused: `printTerms()` in
`server/src/services/entitlement.ts` allows an unpaid list only in the free template (402,
code `4021` otherwise), and the web stops the download first (`isPrintable` in
`src/constants/templates.ts`), offering to switch to the free template. `BILLING_ENABLED` only
adds the "made with" line to free prints. The pricing page says payments are coming soon.

## What is already in place

- `GuestList.paidAt` (schema) and `paidAt` in every list the API returns.
- `printTerms()` — a paid list prints as designed; an unpaid list prints only in the free
  template (with the `guests-seating-board.eapps.site` line on each page once `BILLING_ENABLED`); a
  premium template unpaid answers **402** with code `4021` (`listNotPaid`), which the web translates.
- Guest-owned server lists (`guestKeyHash`, `lib/guest.ts`) and their move to the account on
  sign-in (`services/guestLists.ts`) — a payment needs a server copy to attach to, exactly as
  cv-builder's guest checkout.
- `/health` reports `billing` and `priceAmd`; the web reads them through `useCapabilities`.
- Prices on the pricing page, the FAQ and JSON-LD come from `LIST_PRICE_AMD` (pinned equal to
  the server's by `tests/unit/server/twins.spec.ts`).

## To build it

Port cv-builder's implementation (`../cv-builder`), which is the same flow for CVs:

1. **Schema:** `Payment` (and, for refund evidence, `PdfDownload`) as in cv-builder's
   `schema.prisma`, keyed to `GuestList` instead of `Cv`.
2. **Server:** `services/payments.ts`, `services/gateways/` (Ameriabank vPOS 3.1 + the dev mock
   bank), `routes/payments.ts`, `POST /lists/:id/checkout`; reconcile pending payments when an
   unpaid list is read. Copy cv-builder's config keys (`PAYMENT_GATEWAY`, `AMERIA_*`) into
   `server/.env.example` and `scripts/env-to-base64.mjs`'s checks.
3. **Entitlement:** flip `BILLING_ENABLED` (or read it from config, refusing `mock` in
   production as cv-builder does) to stamp free prints.
4. **Web:** a checkout dialog from the editor's Download when `printTerms` would refuse
   (today `PdfActions` offers the free template instead)
   (cv-builder's `CheckoutModal`, including the guest "buy without an account" path), the
   payment result page, a paid badge on dashboard cards, the `begin_checkout` / `purchase`
   analytics events.
5. **Copy and legal:** remove `Pricing.beta`; add payment terms to `TERMS` and a refund policy
   page (the bank's merchant agreement requires one); `docs/PAYMENTS.md` from cv-builder.
