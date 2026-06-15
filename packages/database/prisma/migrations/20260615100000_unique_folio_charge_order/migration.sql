CREATE UNIQUE INDEX "FolioCharge_tenantId_orderId_key" ON "FolioCharge"("tenantId", "orderId");
DROP INDEX IF EXISTS "FolioCharge_tenantId_orderId_idx";
