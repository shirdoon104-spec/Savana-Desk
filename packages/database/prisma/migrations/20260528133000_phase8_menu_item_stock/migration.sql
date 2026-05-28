-- Add stock and 86-list support for restaurant menu items.
ALTER TABLE "MenuItem"
ADD COLUMN "stockEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "currentStock" INTEGER,
ADD COLUMN "isAvailable" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "MenuItem_tenantId_restaurantId_isAvailable_idx"
ON "MenuItem"("tenantId", "restaurantId", "isAvailable");
