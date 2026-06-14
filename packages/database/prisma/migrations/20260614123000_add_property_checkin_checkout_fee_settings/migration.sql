ALTER TABLE "Property"
ADD COLUMN "earlyCheckInBeforeTime" TEXT,
ADD COLUMN "earlyCheckInFeeType" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN "earlyCheckInFeeValue" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "lateCheckoutAfterTime" TEXT,
ADD COLUMN "lateCheckoutFeeType" TEXT NOT NULL DEFAULT 'none',
ADD COLUMN "lateCheckoutFeeValue" DECIMAL(65,30) NOT NULL DEFAULT 0;
