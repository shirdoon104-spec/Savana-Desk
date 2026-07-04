ALTER TABLE "Room" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;

DROP INDEX IF EXISTS "Room_tenantId_propertyId_status_idx";
CREATE INDEX "Room_tenantId_propertyId_isActive_status_idx"
ON "Room"("tenantId", "propertyId", "isActive", "status");