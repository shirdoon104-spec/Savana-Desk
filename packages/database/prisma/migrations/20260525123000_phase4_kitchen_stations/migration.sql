-- Phase 4: kitchen stations and station routing.

CREATE TABLE "KitchenStation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "KitchenStationType" NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "KitchenStation_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "MenuCategory" ADD COLUMN "defaultStation" "KitchenStationType";
ALTER TABLE "MenuItem" ADD COLUMN "kitchenStation" "KitchenStationType";

CREATE INDEX "KitchenStation_tenantId_propertyId_restaurantId_isActive_idx" ON "KitchenStation"("tenantId", "propertyId", "restaurantId", "isActive");
CREATE UNIQUE INDEX "KitchenStation_restaurantId_type_key" ON "KitchenStation"("restaurantId", "type");

ALTER TABLE "KitchenStation" ADD CONSTRAINT "KitchenStation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
