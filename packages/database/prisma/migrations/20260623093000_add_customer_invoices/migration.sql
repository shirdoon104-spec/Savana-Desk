CREATE TYPE "InvoiceStatus" AS ENUM ('issued', 'voided');

ALTER TYPE "HotelAuditEvent" ADD VALUE IF NOT EXISTS 'customer_invoice_generated';

CREATE TABLE "CustomerInvoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "folioId" TEXT NOT NULL,
    "stayId" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'issued',
    "currency" TEXT NOT NULL,
    "lineItemTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "paymentTotal" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "balance" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedById" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CustomerInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerInvoiceLineItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL DEFAULT 1,
    "unitAmount" DECIMAL(65,30),
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerInvoiceLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CustomerInvoicePayment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL,
    "reference" TEXT,
    "paidAt" TIMESTAMP(3),
    "sourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CustomerInvoicePayment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerInvoice_folioId_key" ON "CustomerInvoice"("folioId");
CREATE UNIQUE INDEX "CustomerInvoice_tenantId_invoiceNumber_key" ON "CustomerInvoice"("tenantId", "invoiceNumber");
CREATE INDEX "CustomerInvoice_tenantId_propertyId_issuedAt_idx" ON "CustomerInvoice"("tenantId", "propertyId", "issuedAt");
CREATE INDEX "CustomerInvoice_tenantId_guestId_issuedAt_idx" ON "CustomerInvoice"("tenantId", "guestId", "issuedAt");
CREATE INDEX "CustomerInvoice_tenantId_stayId_idx" ON "CustomerInvoice"("tenantId", "stayId");
CREATE INDEX "CustomerInvoiceLineItem_tenantId_propertyId_invoiceId_createdAt_idx" ON "CustomerInvoiceLineItem"("tenantId", "propertyId", "invoiceId", "createdAt");
CREATE INDEX "CustomerInvoicePayment_tenantId_propertyId_invoiceId_createdAt_idx" ON "CustomerInvoicePayment"("tenantId", "propertyId", "invoiceId", "createdAt");

ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "GuestFolio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoice" ADD CONSTRAINT "CustomerInvoice_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoiceLineItem" ADD CONSTRAINT "CustomerInvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerInvoicePayment" ADD CONSTRAINT "CustomerInvoicePayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CustomerInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
