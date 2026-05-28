-- Phase 8.3: restaurant reservations and walk-in waitlist.

CREATE TYPE "ReservationStatus" AS ENUM (
    'confirmed',
    'waitlisted',
    'seated',
    'cancelled',
    'no_show'
);

CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestId" TEXT,
    "partySize" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "tableId" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'confirmed',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Reservation_tenantId_propertyId_restaurantId_scheduledAt_idx" ON "Reservation"("tenantId", "propertyId", "restaurantId", "scheduledAt");
CREATE INDEX "Reservation_tenantId_restaurantId_status_idx" ON "Reservation"("tenantId", "restaurantId", "status");
CREATE INDEX "Reservation_tenantId_tableId_scheduledAt_idx" ON "Reservation"("tenantId", "tableId", "scheduledAt");

ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
