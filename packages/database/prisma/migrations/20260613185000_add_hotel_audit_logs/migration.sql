-- CreateEnum
CREATE TYPE "HotelAuditEvent" AS ENUM ('room_status_changed', 'check_in_completed', 'check_out_completed');

-- CreateTable
CREATE TABLE "HotelAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT,
    "stayId" TEXT,
    "reservationId" TEXT,
    "event" "HotelAuditEvent" NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "previousState" JSONB,
    "newState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HotelAuditLog_tenantId_propertyId_createdAt_idx" ON "HotelAuditLog"("tenantId", "propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "HotelAuditLog_tenantId_roomId_createdAt_idx" ON "HotelAuditLog"("tenantId", "roomId", "createdAt");

-- CreateIndex
CREATE INDEX "HotelAuditLog_tenantId_stayId_createdAt_idx" ON "HotelAuditLog"("tenantId", "stayId", "createdAt");

-- CreateIndex
CREATE INDEX "HotelAuditLog_tenantId_reservationId_createdAt_idx" ON "HotelAuditLog"("tenantId", "reservationId", "createdAt");

-- AddForeignKey
ALTER TABLE "HotelAuditLog" ADD CONSTRAINT "HotelAuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelAuditLog" ADD CONSTRAINT "HotelAuditLog_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelAuditLog" ADD CONSTRAINT "HotelAuditLog_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelAuditLog" ADD CONSTRAINT "HotelAuditLog_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE SET NULL ON UPDATE CASCADE;
