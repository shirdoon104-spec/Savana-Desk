ALTER TABLE "HotelReservation"
ADD COLUMN "isComplimentary" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "complimentaryReason" TEXT;
