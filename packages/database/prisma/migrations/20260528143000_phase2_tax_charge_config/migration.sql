ALTER TABLE "Property"
ADD COLUMN "taxRate" DECIMAL,
ADD COLUMN "serviceChargeRate" DECIMAL;

ALTER TABLE "Restaurant"
ADD COLUMN "taxRate" DECIMAL,
ADD COLUMN "serviceChargeRate" DECIMAL;
