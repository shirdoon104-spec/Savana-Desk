CREATE TYPE "HousekeepingTaskType" AS ENUM ('cleaning', 'inspection');

CREATE TYPE "HousekeepingTaskStatus" AS ENUM ('open', 'in_progress', 'done', 'inspected', 'cancelled');

CREATE TYPE "HousekeepingPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

CREATE TABLE "HousekeepingTask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "stayId" TEXT,
    "type" "HousekeepingTaskType" NOT NULL DEFAULT 'cleaning',
    "status" "HousekeepingTaskStatus" NOT NULL DEFAULT 'open',
    "priority" "HousekeepingPriority" NOT NULL DEFAULT 'normal',
    "reason" TEXT,
    "assignedUserId" TEXT,
    "createdByUserId" TEXT,
    "completedByUserId" TEXT,
    "completedAt" TIMESTAMP(3),
    "inspectedByUserId" TEXT,
    "inspectedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HousekeepingTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HousekeepingTask_tenantId_propertyId_status_idx" ON "HousekeepingTask"("tenantId", "propertyId", "status");

CREATE INDEX "HousekeepingTask_tenantId_roomId_status_idx" ON "HousekeepingTask"("tenantId", "roomId", "status");

CREATE INDEX "HousekeepingTask_tenantId_stayId_idx" ON "HousekeepingTask"("tenantId", "stayId");

ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "HousekeepingTask" ADD CONSTRAINT "HousekeepingTask_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TYPE "HotelAuditEvent" ADD VALUE 'housekeeping_task_created';
ALTER TYPE "HotelAuditEvent" ADD VALUE 'housekeeping_task_updated';
