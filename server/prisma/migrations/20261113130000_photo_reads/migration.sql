-- Photo reading comes with a running access pass, 5 reads per pass (services/photoQuota.ts).
-- Each read is a row: who (account or guest key) and when — nothing of the photo. Moved to the
-- account on sign-in like lists; swept after a year.
-- CreateTable
CREATE TABLE "PhotoRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "guestKeyHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoRead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoRead_userId_createdAt_idx" ON "PhotoRead"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PhotoRead_guestKeyHash_createdAt_idx" ON "PhotoRead"("guestKeyHash", "createdAt");

-- CreateIndex
CREATE INDEX "PhotoRead_createdAt_idx" ON "PhotoRead"("createdAt");

-- AddForeignKey
ALTER TABLE "PhotoRead" ADD CONSTRAINT "PhotoRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
