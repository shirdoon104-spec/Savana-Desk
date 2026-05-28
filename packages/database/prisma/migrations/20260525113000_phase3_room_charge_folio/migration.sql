-- CreateTable
CREATE TABLE "FolioCharge" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "orderId" TEXT,
    "restaurantId" TEXT,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "postedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FolioCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FolioCharge_tenantId_stayId_createdAt_idx" ON "FolioCharge"("tenantId", "stayId", "createdAt");

-- CreateIndex
CREATE INDEX "FolioCharge_tenantId_orderId_idx" ON "FolioCharge"("tenantId", "orderId");

-- AddForeignKey
ALTER TABLE "FolioCharge" ADD CONSTRAINT "FolioCharge_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
