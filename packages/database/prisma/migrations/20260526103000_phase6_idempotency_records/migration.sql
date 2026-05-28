-- Phase 6 idempotent mutation response cache.
CREATE TABLE "IdempotencyRecord" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "route" TEXT NOT NULL,
  "requestHash" TEXT NOT NULL,
  "responseStatus" INTEGER NOT NULL DEFAULT 200,
  "responseBody" JSONB NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyRecord_tenantId_key_key" ON "IdempotencyRecord"("tenantId", "key");
CREATE INDEX "IdempotencyRecord_tenantId_expiresAt_idx" ON "IdempotencyRecord"("tenantId", "expiresAt");
CREATE INDEX "IdempotencyRecord_tenantId_actorId_route_idx" ON "IdempotencyRecord"("tenantId", "actorId", "route");
