-- CreateEnum
CREATE TYPE "HotelReservationStatus" AS ENUM ('draft', 'confirmed', 'guaranteed', 'checked_in', 'checked_out', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "HotelReservationSource" AS ENUM ('walk_in', 'phone', 'direct', 'ota', 'corporate');

-- CreateEnum
CREATE TYPE "ReservationGuaranteeStatus" AS ENUM ('active', 'released', 'charged', 'failed');

-- CreateTable
CREATE TABLE "HotelReservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "assignedRoomId" TEXT,
    "ratePlanId" TEXT,
    "confirmationCode" TEXT NOT NULL,
    "status" "HotelReservationStatus" NOT NULL DEFAULT 'confirmed',
    "source" "HotelReservationSource" NOT NULL DEFAULT 'walk_in',
    "arrivalDate" TIMESTAMP(3) NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "adultCount" INTEGER NOT NULL DEFAULT 1,
    "childCount" INTEGER NOT NULL DEFAULT 0,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT,
    "guestPhone" TEXT,
    "depositRequiredAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "depositPaidAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "rateOverride" DECIMAL(65,30),
    "notes" TEXT,
    "specialRequests" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "statusChangedByUserId" TEXT,
    "statusChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelReservationGuest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "guestId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelReservationGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationGuarantee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "provider" TEXT,
    "providerToken" TEXT,
    "status" "ReservationGuaranteeStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationGuarantee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HotelReservation_tenantId_confirmationCode_key" ON "HotelReservation"("tenantId", "confirmationCode");

-- CreateIndex
CREATE INDEX "HotelReservation_tenantId_propertyId_arrivalDate_departureDate_idx" ON "HotelReservation"("tenantId", "propertyId", "arrivalDate", "departureDate");

-- CreateIndex
CREATE INDEX "HotelReservation_tenantId_propertyId_status_idx" ON "HotelReservation"("tenantId", "propertyId", "status");

-- CreateIndex
CREATE INDEX "HotelReservation_tenantId_roomTypeId_arrivalDate_idx" ON "HotelReservation"("tenantId", "roomTypeId", "arrivalDate");

-- CreateIndex
CREATE INDEX "HotelReservation_tenantId_assignedRoomId_arrivalDate_idx" ON "HotelReservation"("tenantId", "assignedRoomId", "arrivalDate");

-- CreateIndex
CREATE INDEX "HotelReservationGuest_tenantId_propertyId_reservationId_idx" ON "HotelReservationGuest"("tenantId", "propertyId", "reservationId");

-- CreateIndex
CREATE INDEX "HotelReservationGuest_tenantId_guestId_idx" ON "HotelReservationGuest"("tenantId", "guestId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationGuarantee_reservationId_key" ON "ReservationGuarantee"("reservationId");

-- CreateIndex
CREATE INDEX "ReservationGuarantee_tenantId_propertyId_status_idx" ON "ReservationGuarantee"("tenantId", "propertyId", "status");

-- AddForeignKey
ALTER TABLE "HotelReservation" ADD CONSTRAINT "HotelReservation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelReservation" ADD CONSTRAINT "HotelReservation_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelReservation" ADD CONSTRAINT "HotelReservation_assignedRoomId_fkey" FOREIGN KEY ("assignedRoomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelReservation" ADD CONSTRAINT "HotelReservation_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelReservationGuest" ADD CONSTRAINT "HotelReservationGuest_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "HotelReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelReservationGuest" ADD CONSTRAINT "HotelReservationGuest_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationGuarantee" ADD CONSTRAINT "ReservationGuarantee_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "HotelReservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
