-- The daily retention sweep looks accounts up by their last use.
CREATE INDEX "User_lastActiveAt_idx" ON "User"("lastActiveAt");
