-- Phase 6 offline reliability: persist terminal conflict and retry details.
ALTER TABLE "OfflineAction"
ADD COLUMN "conflictReason" TEXT,
ADD COLUMN "lastError" TEXT,
ADD COLUMN "resolvedAt" TIMESTAMP(3);
