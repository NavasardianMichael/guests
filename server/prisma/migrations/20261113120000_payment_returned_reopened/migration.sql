-- When the bank first sent the buyer back for this payment (routes/payments.ts). A payment
-- the buyer came back from is finished on their side; one they did not may still be open in
-- another tab — offered to continue before a new checkout starts (services/payments.ts,
-- findOpenPayment). `reopenedAt`: when the buyer was sent back to that still-open bank page
-- (resumeOpenPayment) — once per payment: if they come back again without the bank sending
-- them, that page may not reopen, and the next click starts a new order.
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "returnedAt" TIMESTAMP(3),
ADD COLUMN "reopenedAt" TIMESTAMP(3);
