-- Access passes replace template purchases (docs/PAYMENTS.md): a succeeded Payment is PASS_DAYS
-- of everything for its owner, whatever the template. Nothing was sold yet, so the per-template
-- column goes. User.lastActiveAt drives the one-year retention sweep (services/retention.ts).
-- DropIndex
DROP INDEX "Payment_userId_templateId_status_idx";

-- DropIndex
DROP INDEX "Payment_guestKeyHash_templateId_status_idx";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "templateId";

-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastActiveAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Payment_userId_status_idx" ON "Payment"("userId", "status");

-- CreateIndex
CREATE INDEX "Payment_guestKeyHash_status_idx" ON "Payment"("guestKeyHash", "status");

-- CreateIndex
CREATE INDEX "GuestList_updatedAt_idx" ON "GuestList"("updatedAt");
