-- CreateEnum
CREATE TYPE "RatePlanStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "CancellationPenaltyType" AS ENUM ('none', 'fixed', 'percent', 'first_night');

-- AlterTable
ALTER TABLE "Room" ADD COLUMN "roomTypeId" TEXT;

-- CreateTable
CREATE TABLE "RoomType" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "baseOccupancy" INTEGER NOT NULL DEFAULT 1,
    "maxOccupancy" INTEGER,
    "defaultCurrency" TEXT NOT NULL DEFAULT 'USD',
    "defaultRate" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RatePlan" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomTypeId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "status" "RatePlanStatus" NOT NULL DEFAULT 'active',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "defaultRate" DECIMAL(65,30),
    "baseOccupancy" INTEGER NOT NULL DEFAULT 1,
    "extraGuestRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "minNights" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RatePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "roomTypeId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "baseRate" DECIMAL(65,30) NOT NULL,
    "extraGuestRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "baseOccupancy" INTEGER NOT NULL DEFAULT 1,
    "minNights" INTEGER NOT NULL DEFAULT 1,
    "currency" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CancellationPolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "ratePlanId" TEXT NOT NULL,
    "freeCancellationUntilHours" INTEGER,
    "penaltyType" "CancellationPenaltyType" NOT NULL DEFAULT 'none',
    "penaltyValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "noShowPenaltyType" "CancellationPenaltyType" NOT NULL DEFAULT 'none',
    "noShowPenaltyValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CancellationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoomType_propertyId_code_key" ON "RoomType"("propertyId", "code");

-- Backfill existing room type snapshots into first-class room types.
INSERT INTO "RoomType" (
    "id",
    "tenantId",
    "propertyId",
    "name",
    "code",
    "defaultCurrency",
    "createdAt",
    "updatedAt"
)
SELECT
    'legacy_room_type_' || substr(md5(room_types."propertyId" || ':' || room_types."type"), 1, 16),
    room_types."tenantId",
    room_types."propertyId",
    room_types."type",
    COALESCE(
        NULLIF(
            substr(
                regexp_replace(
                    regexp_replace(
                        regexp_replace(lower(trim(room_types."type")), '[^a-z0-9]+', '-', 'g'),
                        '^-+',
                        ''
                    ),
                    '-+$',
                    ''
                ),
                1,
                48
            ),
            ''
        ),
        'standard'
    ),
    COALESCE(properties."currency", 'USD'),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM (
    SELECT DISTINCT "tenantId", "propertyId", "type"
    FROM "Room"
    WHERE "type" IS NOT NULL AND trim("type") <> ''
) room_types
JOIN "Property" properties ON properties."id" = room_types."propertyId"
ON CONFLICT ("propertyId", "code") DO NOTHING;

UPDATE "Room"
SET "roomTypeId" = room_types."id"
FROM "RoomType" room_types
WHERE room_types."propertyId" = "Room"."propertyId"
  AND room_types."name" = "Room"."type";

-- CreateIndex
CREATE INDEX "RoomType_tenantId_propertyId_isActive_idx" ON "RoomType"("tenantId", "propertyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "RatePlan_propertyId_code_key" ON "RatePlan"("propertyId", "code");

-- CreateIndex
CREATE INDEX "RatePlan_tenantId_propertyId_status_idx" ON "RatePlan"("tenantId", "propertyId", "status");

-- CreateIndex
CREATE INDEX "RatePlan_tenantId_propertyId_roomTypeId_idx" ON "RatePlan"("tenantId", "propertyId", "roomTypeId");

-- CreateIndex
CREATE INDEX "RoomRate_tenantId_propertyId_roomTypeId_startDate_endDate_idx" ON "RoomRate"("tenantId", "propertyId", "roomTypeId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "RoomRate_tenantId_propertyId_ratePlanId_isActive_idx" ON "RoomRate"("tenantId", "propertyId", "ratePlanId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "CancellationPolicy_ratePlanId_key" ON "CancellationPolicy"("ratePlanId");

-- CreateIndex
CREATE INDEX "CancellationPolicy_tenantId_propertyId_idx" ON "CancellationPolicy"("tenantId", "propertyId");

-- CreateIndex
CREATE INDEX "Room_tenantId_propertyId_roomTypeId_idx" ON "Room"("tenantId", "propertyId", "roomTypeId");

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomType" ADD CONSTRAINT "RoomType_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RatePlan" ADD CONSTRAINT "RatePlan_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRate" ADD CONSTRAINT "RoomRate_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoomRate" ADD CONSTRAINT "RoomRate_roomTypeId_fkey" FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CancellationPolicy" ADD CONSTRAINT "CancellationPolicy_ratePlanId_fkey" FOREIGN KEY ("ratePlanId") REFERENCES "RatePlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
