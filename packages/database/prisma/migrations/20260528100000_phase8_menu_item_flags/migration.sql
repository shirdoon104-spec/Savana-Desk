-- Phase 8.1: allergen and dietary flags for restaurant menu items.

ALTER TABLE "MenuItem" ADD COLUMN "allergens" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MenuItem" ADD COLUMN "dietary" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
