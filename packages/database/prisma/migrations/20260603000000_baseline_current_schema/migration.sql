-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('confirmed', 'waitlisted', 'seated', 'cancelled', 'no_show');

-- CreateEnum
CREATE TYPE "OrderSource" AS ENUM ('dine_in', 'counter', 'takeaway', 'delivery', 'room_service');

-- CreateEnum
CREATE TYPE "OrderPaymentStatus" AS ENUM ('unpaid', 'partial', 'paid', 'refunded', 'voided');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('pending', 'sent', 'preparing', 'ready', 'served', 'voided');

-- CreateEnum
CREATE TYPE "KitchenStationType" AS ENUM ('bar', 'grill', 'main_kitchen', 'dessert', 'cold_station');

-- CreateEnum
CREATE TYPE "PaymentWebhookOutcome" AS ENUM ('success', 'rejected', 'duplicate');

-- CreateEnum
CREATE TYPE "OrderPaymentMethod" AS ENUM ('paystack', 'cash', 'card_manual', 'room_charge', 'complimentary', 'voucher');

-- CreateEnum
CREATE TYPE "OrderPaymentLedgerStatus" AS ENUM ('pending', 'confirmed', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "OrderDiscountType" AS ENUM ('percent', 'fixed', 'item');

-- CreateEnum
CREATE TYPE "OrderAuditEvent" AS ENUM ('order_created', 'item_added', 'item_removed', 'item_voided', 'status_changed', 'payment_initiated', 'payment_confirmed', 'payment_refunded', 'discount_applied', 'order_closed', 'order_cancelled', 'charge_to_room_posted', 'table_transferred', 'course_fired');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "clerkOrgId" TEXT NOT NULL,
    "operatingModel" TEXT NOT NULL DEFAULT 'hotel_restaurant',
    "mobileMoneyProvider" TEXT,
    "onboardingCompletedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantUser" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clerkUserId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "removedAt" TIMESTAMP(3),
    "removedByClerkUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffInvitation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clerkOrgId" TEXT NOT NULL,
    "clerkInvitationId" TEXT,
    "invitationUrl" TEXT,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invitedByClerkUserId" TEXT NOT NULL,
    "acceptedByClerkUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "roomCount" INTEGER,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Mogadishu',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "taxRate" DECIMAL(65,30),
    "serviceChargeRate" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceStyle" TEXT,
    "taxRate" DECIMAL(65,30),
    "serviceChargeRate" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
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

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Stay" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "checkInAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedCheckOutAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "checkedInByUserId" TEXT NOT NULL,
    "checkedOutByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Stay_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "RestaurantTable" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'free',
    "coverCount" INTEGER NOT NULL DEFAULT 0,
    "assignedWaiterUserId" TEXT,
    "assignedWaiterName" TEXT,
    "qrCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "guestId" TEXT,
    "partySize" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "tableId" TEXT,
    "status" "ReservationStatus" NOT NULL DEFAULT 'confirmed',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "totalPrice" DECIMAL(65,30) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tableId" TEXT,
    "source" "OrderSource" NOT NULL DEFAULT 'dine_in',
    "covers" INTEGER NOT NULL DEFAULT 0,
    "waiterId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "subtotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "serviceChargeAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "serviceChargeRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentStatus" "OrderPaymentStatus" NOT NULL DEFAULT 'unpaid',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "notes" TEXT,
    "courseCount" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultStation" "KitchenStationType",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "kitchenStation" "KitchenStationType",
    "allergens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dietary" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "stockEnabled" BOOLEAN NOT NULL DEFAULT false,
    "currentStock" INTEGER,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "price" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "status" "OrderItemStatus" NOT NULL DEFAULT 'pending',
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "course" INTEGER NOT NULL DEFAULT 1,
    "kitchenStation" "KitchenStationType",
    "modifiers" JSONB,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    "totalPrice" DECIMAL(65,30) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "preparedAt" TIMESTAMP(3),
    "servedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "restaurantId" TEXT,
    "orderId" TEXT,
    "folioId" TEXT,
    "provider" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "accessCode" TEXT,
    "checkoutUrl" TEXT,
    "customerPhone" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

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
CREATE TABLE "IdempotencyRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL DEFAULT 200,
    "responseBody" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
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

-- CreateTable
CREATE TABLE "OfflineAction" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "restaurantId" TEXT,
    "deviceId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "actionType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "conflictReason" TEXT,
    "lastError" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfflineAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_clerkOrgId_key" ON "Tenant"("clerkOrgId");

-- CreateIndex
CREATE INDEX "TenantUser_clerkUserId_idx" ON "TenantUser"("clerkUserId");

-- CreateIndex
CREATE INDEX "TenantUser_tenantId_status_idx" ON "TenantUser"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TenantUser_tenantId_clerkUserId_key" ON "TenantUser"("tenantId", "clerkUserId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvitation_clerkInvitationId_key" ON "StaffInvitation"("clerkInvitationId");

-- CreateIndex
CREATE INDEX "StaffInvitation_clerkOrgId_email_idx" ON "StaffInvitation"("clerkOrgId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "StaffInvitation_tenantId_email_key" ON "StaffInvitation"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Property_tenantId_idx" ON "Property"("tenantId");

-- CreateIndex
CREATE INDEX "Restaurant_tenantId_propertyId_idx" ON "Restaurant"("tenantId", "propertyId");

-- CreateIndex
CREATE INDEX "KitchenStation_tenantId_propertyId_restaurantId_isActive_idx" ON "KitchenStation"("tenantId", "propertyId", "restaurantId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "KitchenStation_restaurantId_type_key" ON "KitchenStation"("restaurantId", "type");

-- CreateIndex
CREATE INDEX "Room_tenantId_propertyId_status_idx" ON "Room"("tenantId", "propertyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Room_propertyId_number_key" ON "Room"("propertyId", "number");

-- CreateIndex
CREATE INDEX "Guest_tenantId_phone_idx" ON "Guest"("tenantId", "phone");

-- CreateIndex
CREATE INDEX "Guest_tenantId_email_idx" ON "Guest"("tenantId", "email");

-- CreateIndex
CREATE INDEX "Stay_tenantId_status_idx" ON "Stay"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Stay_tenantId_roomId_status_idx" ON "Stay"("tenantId", "roomId", "status");

-- CreateIndex
CREATE INDEX "Stay_tenantId_guestId_checkInAt_idx" ON "Stay"("tenantId", "guestId", "checkInAt");

-- CreateIndex
CREATE INDEX "FolioCharge_tenantId_stayId_createdAt_idx" ON "FolioCharge"("tenantId", "stayId", "createdAt");

-- CreateIndex
CREATE INDEX "FolioCharge_tenantId_orderId_idx" ON "FolioCharge"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "RestaurantTable_tenantId_propertyId_restaurantId_idx" ON "RestaurantTable"("tenantId", "propertyId", "restaurantId");

-- CreateIndex
CREATE INDEX "RestaurantTable_tenantId_restaurantId_status_idx" ON "RestaurantTable"("tenantId", "restaurantId", "status");

-- CreateIndex
CREATE INDEX "Reservation_tenantId_propertyId_restaurantId_scheduledAt_idx" ON "Reservation"("tenantId", "propertyId", "restaurantId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Reservation_tenantId_restaurantId_status_idx" ON "Reservation"("tenantId", "restaurantId", "status");

-- CreateIndex
CREATE INDEX "Reservation_tenantId_tableId_scheduledAt_idx" ON "Reservation"("tenantId", "tableId", "scheduledAt");

-- CreateIndex
CREATE INDEX "ReservationItem_tenantId_reservationId_idx" ON "ReservationItem"("tenantId", "reservationId");

-- CreateIndex
CREATE INDEX "ReservationItem_menuItemId_idx" ON "ReservationItem"("menuItemId");

-- CreateIndex
CREATE INDEX "Order_tenantId_propertyId_restaurantId_status_idx" ON "Order"("tenantId", "propertyId", "restaurantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Order_tenantId_idempotencyKey_key" ON "Order"("tenantId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "MenuCategory_tenantId_propertyId_restaurantId_isActive_idx" ON "MenuCategory"("tenantId", "propertyId", "restaurantId", "isActive");

-- CreateIndex
CREATE INDEX "MenuItem_tenantId_propertyId_restaurantId_isActive_idx" ON "MenuItem"("tenantId", "propertyId", "restaurantId", "isActive");

-- CreateIndex
CREATE INDEX "MenuItem_tenantId_restaurantId_isAvailable_idx" ON "MenuItem"("tenantId", "restaurantId", "isAvailable");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "OrderItem_tenantId_propertyId_orderId_idx" ON "OrderItem"("tenantId", "propertyId", "orderId");

-- CreateIndex
CREATE INDEX "OrderItem_tenantId_orderId_status_idx" ON "OrderItem"("tenantId", "orderId", "status");

-- CreateIndex
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_tenantId_propertyId_status_idx" ON "Payment"("tenantId", "propertyId", "status");

-- CreateIndex
CREATE INDEX "Payment_provider_providerTransactionId_idx" ON "Payment"("provider", "providerTransactionId");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_provider_reference_idx" ON "PaymentWebhookLog"("provider", "reference");

-- CreateIndex
CREATE INDEX "PaymentWebhookLog_tenantId_createdAt_idx" ON "PaymentWebhookLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_tenantId_expiresAt_idx" ON "IdempotencyRecord"("tenantId", "expiresAt");

-- CreateIndex
CREATE INDEX "IdempotencyRecord_tenantId_actorId_route_idx" ON "IdempotencyRecord"("tenantId", "actorId", "route");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyRecord_tenantId_key_key" ON "IdempotencyRecord"("tenantId", "key");

-- CreateIndex
CREATE INDEX "OrderPayment_tenantId_orderId_status_idx" ON "OrderPayment"("tenantId", "orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "OrderPayment_tenantId_method_reference_key" ON "OrderPayment"("tenantId", "method", "reference");

-- CreateIndex
CREATE INDEX "OrderDiscount_tenantId_orderId_idx" ON "OrderDiscount"("tenantId", "orderId");

-- CreateIndex
CREATE INDEX "OrderDiscount_tenantId_orderItemId_idx" ON "OrderDiscount"("tenantId", "orderItemId");

-- CreateIndex
CREATE INDEX "OrderAuditLog_tenantId_orderId_createdAt_idx" ON "OrderAuditLog"("tenantId", "orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OfflineAction_idempotencyKey_key" ON "OfflineAction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "OfflineAction_tenantId_propertyId_status_idx" ON "OfflineAction"("tenantId", "propertyId", "status");

-- CreateIndex
CREATE INDEX "OfflineAction_deviceId_occurredAt_idx" ON "OfflineAction"("deviceId", "occurredAt");

-- AddForeignKey
ALTER TABLE "TenantUser" ADD CONSTRAINT "TenantUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvitation" ADD CONSTRAINT "StaffInvitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenStation" ADD CONSTRAINT "KitchenStation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolioCharge" ADD CONSTRAINT "FolioCharge_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "Stay"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantTable" ADD CONSTRAINT "RestaurantTable_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationItem" ADD CONSTRAINT "ReservationItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderDiscount" ADD CONSTRAINT "OrderDiscount_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderAuditLog" ADD CONSTRAINT "OrderAuditLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

