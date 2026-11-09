-- Payments per template (docs/PAYMENTS.md): a succeeded Payment is its owner's licence for that
-- template on every list. GuestList.paidAt was never set (billing was not built) and is replaced
-- by that licence. PdfDownload is the delivery evidence for refund claims.
-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('ameria', 'mock');

-- AlterTable
ALTER TABLE "GuestList" DROP COLUMN "paidAt";

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderNumber" SERIAL NOT NULL,
    "userId" TEXT,
    "guestKeyHash" TEXT,
    "templateId" TEXT NOT NULL,
    "listId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'AMD',
    "gateway" "PaymentGateway" NOT NULL,
    "gatewayPaymentId" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "failureReason" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PdfDownload" (
    "id" TEXT NOT NULL,
    "listId" TEXT,
    "templateId" TEXT NOT NULL,
    "paymentId" TEXT,
    "bytes" INTEGER NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PdfDownload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_orderNumber_key" ON "Payment"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_gatewayPaymentId_key" ON "Payment"("gatewayPaymentId");

-- CreateIndex
CREATE INDEX "Payment_userId_templateId_status_idx" ON "Payment"("userId", "templateId", "status");

-- CreateIndex
CREATE INDEX "Payment_guestKeyHash_templateId_status_idx" ON "Payment"("guestKeyHash", "templateId", "status");

-- CreateIndex
CREATE INDEX "PdfDownload_listId_createdAt_idx" ON "PdfDownload"("listId", "createdAt");

-- CreateIndex
CREATE INDEX "PdfDownload_paymentId_idx" ON "PdfDownload"("paymentId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_listId_fkey" FOREIGN KEY ("listId") REFERENCES "GuestList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfDownload" ADD CONSTRAINT "PdfDownload_listId_fkey" FOREIGN KEY ("listId") REFERENCES "GuestList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PdfDownload" ADD CONSTRAINT "PdfDownload_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

