-- CreateEnum
CREATE TYPE "FolioStatus" AS ENUM ('open', 'pending_checkout', 'closed', 'locked', 'void');

-- CreateEnum
CREATE TYPE "FolioLineItemType" AS ENUM ('room_night', 'restaurant_charge', 'manual_charge', 'tax', 'service_charge', 'discount', 'deposit', 'refund', 'adjustment');

-- CreateEnum
CREATE TYPE "FolioPaymentStatus" AS ENUM ('pending', 'confirmed', 'failed', 'refunded', 'voided');

-- CreateEnum
CREATE TYPE "FolioAdjustmentStatus" AS ENUM ('pending', 'approved', 'rejected', 'posted', 'voided');

-- AlterTable
ALTER TABLE "FolioCharge" ADD COLUMN "folioId" TEXT;

-- CreateTable
CREATE TABLE "GuestFolio" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "status" "FolioStatus" NOT NULL DEFAULT 'open',
    "currency" TEXT NOT NULL,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "lockedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "closedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuestFolio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioLineItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "type" "FolioLineItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitAmount" DECIMAL(65,30),
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "postedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolioLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "provider" TEXT,
    "providerTransactionId" TEXT,
    "reference" TEXT,
    "status" "FolioPaymentStatus" NOT NULL DEFAULT 'pending',
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "paidAt" TIMESTAMP(3),
    "recordedById" TEXT,
    "refundedAt" TIMESTAMP(3),
    "refundedById" TEXT,
    "refundReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FolioPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolioAdjustment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "lineItemId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "FolioAdjustmentStatus" NOT NULL DEFAULT 'posted',
    "authorizedById" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolioAdjustment_pkey" PRIMARY KEY ("id")
);

-- Backfill one folio for each stay while preserving Stay.id folio compatibility.
INSERT INTO "GuestFolio" (
    "id",
    "tenantId",
    "propertyId",
    "stayId",
    "guestId",
    "status",
    "currency",
    "balance",
    "openedAt",
    "closedAt",
    "createdByUserId",
    "closedByUserId",
    "createdAt",
    "updatedAt"
)
SELECT
    'gf_' || s."id",
    s."tenantId",
    s."propertyId",
    s."id",
    s."guestId",
    CASE WHEN s."status" = 'checked_out' THEN 'closed'::"FolioStatus" ELSE 'open'::"FolioStatus" END,
    COALESCE(p."currency", 'USD'),
    COALESCE(charges."balance", 0),
    s."checkInAt",
    s."checkOutAt",
    s."checkedInByUserId",
    s."checkedOutByUserId",
    s."createdAt",
    CURRENT_TIMESTAMP
FROM "Stay" s
JOIN "Property" p ON p."id" = s."propertyId"
LEFT JOIN (
    SELECT "stayId", SUM("amount") AS "balance"
    FROM "FolioCharge"
    GROUP BY "stayId"
) charges ON charges."stayId" = s."id"
ON CONFLICT ("id") DO NOTHING;

UPDATE "FolioCharge" fc
SET "folioId" = gf."id"
FROM "GuestFolio" gf
WHERE gf."stayId" = fc."stayId"
  AND fc."folioId" IS NULL;

-- Backfill existing restaurant room charges as explicit append-only folio line items.
INSERT INTO "FolioLineItem" (
    "id",
    "tenantId",
    "propertyId",
    "folioId",
    "type",
    "description",
    "quantity",
    "unitAmount",
    "amount",
    "currency",
    "sourceType",
    "sourceId",
    "postedById",
    "createdAt"
)
SELECT
    'fli_' || fc."id",
    fc."tenantId",
    fc."propertyId",
    fc."folioId",
    CASE WHEN fc."restaurantId" IS NOT NULL THEN 'restaurant_charge'::"FolioLineItemType" ELSE 'manual_charge'::"FolioLineItemType" END,
    fc."description",
    1,
    fc."amount",
    fc."amount",
    fc."currency",
    CASE WHEN fc."orderId" IS NOT NULL THEN 'restaurant_order' ELSE 'legacy_folio_charge' END,
    COALESCE(fc."orderId", fc."id"),
    fc."postedById",
    fc."createdAt"
FROM "FolioCharge" fc
WHERE fc."folioId" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

-- CreateIndex
CREATE UNIQUE INDEX "GuestFolio_stayId_key" ON "GuestFolio"("stayId");

-- CreateIndex
CREATE INDEX "GuestFolio_tenantId_propertyId_status_idx" ON "GuestFolio"("tenantId", "propertyId", "status");

-- CreateIndex
CREATE INDEX "GuestFolio_tenantId_guestId_openedAt_idx" ON "GuestFolio"("tenantId", "guestId", "openedAt");

-- CreateIndex
CREATE INDEX "FolioLineItem_tenantId_propertyId_folioId_createdAt_idx" ON "FolioLineItem"("tenantId", "propertyId", "folioId", "createdAt");

-- CreateIndex
CREATE INDEX "FolioLineItem_tenantId_sourceType_sourceId_idx" ON "FolioLineItem"("tenantId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "FolioPayment_tenantId_propertyId_folioId_status_idx" ON "FolioPayment"("tenantId", "propertyId", "folioId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FolioPayment_tenantId_method_reference_key" ON "FolioPayment"("tenantId", "method", "reference");

-- CreateIndex
CREATE INDEX "FolioAdjustment_tenantId_propertyId_folioId_createdAt_idx" ON "FolioAdjustment"("tenantId", "propertyId", "folioId", "createdAt");

-- CreateIndex
CREATE INDEX "FolioAdjustment_tenantId_lineItemId_idx" ON "FolioAdjustment"("tenantId", "lineItemId");

-- CreateIndex
CREATE INDEX "FolioCharge_tenantId_folioId_idx" ON "FolioCharge"("tenantId", "folioId");

-- AddForeignKey
ALTER TABLE "GuestFolio" ADD CONSTRAINT "GuestFolio_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestFolio" ADD CONSTRAINT "GuestFolio_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestFolio" ADD CONSTRAINT "GuestFolio_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestFolio" ADD CONSTRAINT "GuestFolio_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioLineItem" ADD CONSTRAINT "FolioLineItem_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "GuestFolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioPayment" ADD CONSTRAINT "FolioPayment_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "GuestFolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioAdjustment" ADD CONSTRAINT "FolioAdjustment_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "GuestFolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioAdjustment" ADD CONSTRAINT "FolioAdjustment_lineItemId_fkey" FOREIGN KEY ("lineItemId") REFERENCES "FolioLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioCharge" ADD CONSTRAINT "FolioCharge_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "GuestFolio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
