CREATE TYPE "MaintenanceRequestStatus" AS ENUM ('open', 'in_progress', 'resolved', 'cancelled');

CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "status" "MaintenanceRequestStatus" NOT NULL DEFAULT 'open',
    "priority" "HousekeepingPriority" NOT NULL DEFAULT 'normal',
    "roomStatus" "RoomStatus" NOT NULL DEFAULT 'maintenance',
    "reason" TEXT NOT NULL,
    "assignedUserId" TEXT,
    "reportedByUserId" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNotes" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MaintenanceRequest_tenantId_propertyId_status_idx"
ON "MaintenanceRequest"("tenantId", "propertyId", "status");

CREATE INDEX "MaintenanceRequest_tenantId_roomId_status_idx"
ON "MaintenanceRequest"("tenantId", "roomId", "status");

ALTER TABLE "MaintenanceRequest"
ADD CONSTRAINT "MaintenanceRequest_tenantId_fkey"
FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaintenanceRequest"
ADD CONSTRAINT "MaintenanceRequest_propertyId_fkey"
FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaintenanceRequest"
ADD CONSTRAINT "MaintenanceRequest_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TYPE "HotelAuditEvent" ADD VALUE 'maintenance_request_created';
ALTER TYPE "HotelAuditEvent" ADD VALUE 'maintenance_request_updated';
