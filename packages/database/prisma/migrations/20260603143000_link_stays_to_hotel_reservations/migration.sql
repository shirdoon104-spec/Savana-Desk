-- AlterTable
ALTER TABLE "Stay" ADD COLUMN "hotelReservationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Stay_hotelReservationId_key" ON "Stay"("hotelReservationId");

-- CreateIndex
CREATE INDEX "Stay_tenantId_hotelReservationId_idx" ON "Stay"("tenantId", "hotelReservationId");

-- AddForeignKey
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_hotelReservationId_fkey" FOREIGN KEY ("hotelReservationId") REFERENCES "HotelReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
