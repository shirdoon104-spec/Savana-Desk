-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('dine_in', 'counter', 'takeaway', 'delivery', 'room_service');

-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('unpaid', 'partial', 'paid', 'refunded', 'voided');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('pending', 'sent', 'preparing', 'ready', 'served', 'voided');

-- CreateEnum
CREATE TYPE "KitchenStationType" AS ENUM ('bar', 'grill', 'main_kitchen', 'dessert', 'cold_station');

-- CreateEnum
CREATE TYPE "OrderDiscountType" AS ENUM ('percent', 'fixed', 'item');

-- CreateEnum
CREATE TYPE "OrderAuditEvent" AS ENUM ('order_created', 'item_added', 'item_removed', 'item_voided', 'status_changed', 'payment_initiated', 'payment_confirmed', 'payment_refunded', 'discount_applied', 'order_closed', 'order_cancelled', 'charge_to_room_posted', 'table_transferred', 'course_fired');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "closedAt" TIMESTAMP(3),
ADD COLUMN "closedById" TEXT,
ADD COLUMN "courseCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "covers" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "notes" TEXT,
ADD COLUMN "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'unpaid',
ADD COLUMN "serviceChargeAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "serviceChargeRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'dine_in',
ADD COLUMN "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "taxRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN "waiterId" TEXT;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "course" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "kitchenStation" "KitchenStationType",
ADD COLUMN "modifiers" JSONB,
ADD COLUMN "preparedAt" TIMESTAMP(3),
ADD COLUMN "sentAt" TIMESTAMP(3),
ADD COLUMN "servedAt" TIMESTAMP(3),
ADD COLUMN "status" "OrderItemStatus" NOT NULL DEFAULT 'pending',
ADD COLUMN "voidReason" TEXT,
ADD COLUMN "voidedAt" TIMESTAMP(3),
ADD COLUMN "voidedById" TEXT;

-- CreateTable
CREATE TABLE "OrderDiscount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT,
    "type" "OrderDiscountType" NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "appliedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderDiscount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderAuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "event" "OrderAuditEvent" NOT NULL,
    "actorId" TEXT,
    "actorRole" TEXT,
    "previousState" JSONB,
    "newState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderDiscount_tenantId_orderId_idx" ON "OrderDiscount"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "OrderDiscount_tenantId_orderItemId_idx" ON "OrderDiscount"("tenantId", "orderItemId");

-- CreateIndex
CREATE INDEX "OrderAuditLog_tenantId_orderId_createdAt_idx" ON "OrderAuditLog"("tenantId", "orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_tenantId_orderId_status_idx" ON "OrderItem"("tenantId", "orderId", "status");

-- AddForeignKey
ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAuditLog" ADD CONSTRAINT "OrderAuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
