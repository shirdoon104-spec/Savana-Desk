-- CreateEnum
CREATE TYPE "PaymentWebhookOutcome" AS ENUM ('success', 'rejected', 'duplicate');

-- CreateEnum
CREATE TYPE "OrderPaymentMethod" AS ENUM ('paystack', 'cash', 'card_manual', 'room_charge', 'complimentary', 'voucher');

-- CreateEnum
CREATE TYPE "OrderPaymentLedgerStatus" AS ENUM ('pending', 'confirmed', 'failed', 'refunded');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "idempotencyKey" TEXT;

-- CreateTable
CREATE TABLE "PaymentWebhookLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "reference" TEXT,
    "tenantId" TEXT,
    "propertyId" TEXT,
    "restaurantId" TEXT,
    "orderId" TEXT,
    "payload" JSONB NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "outcome" "PaymentWebhookOutcome" NOT NULL,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentWebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderPayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" "OrderPaymentMethod" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "reference" TEXT,
    "status" "OrderPaymentLedgerStatus" NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "recordedById" TEXT,
    "refundedAt" TIMESTAMP(3),
    "refundedById" TEXT,
    "refundReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_provider_reference_idx" ON "PaymentWebhookLog"("provider", "reference");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_tenantId_createdAt_idx" ON "PaymentWebhookLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderPayment_tenantId_orderId_status_idx" ON "OrderPayment"("tenantId", "orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrderPayment_tenantId_method_reference_key" ON "OrderPayment"("tenantId", "method", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "Order_tenantId_idempotencyKey_key" ON "Order"("tenantId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
