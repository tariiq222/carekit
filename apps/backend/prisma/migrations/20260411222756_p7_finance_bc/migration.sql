-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'PARTIALLY_PAID', 'VOID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('ONLINE_CARD', 'BANK_TRANSFER', 'CASH', 'GIFT_CARD', 'COUPON');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PENDING_VERIFICATION', 'COMPLETED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ZatcaSubmissionStatus" AS ENUM ('PENDING', 'SUBMITTED', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "discountAmt" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,4) NOT NULL DEFAULT 0.15,
    "vatAmt" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "issuedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "gatewayRef" TEXT,
    "idempotencyKey" TEXT,
    "receiptUrl" TEXT,
    "failureReason" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL,
    "discountValue" DECIMAL(12,2) NOT NULL,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "minOrderAmt" DECIMAL(12,2),
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CouponRedemption" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "couponId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "discount" DECIMAL(12,2) NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CouponRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCard" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "initialBalance" DECIMAL(12,2) NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "recipientName" TEXT,
    "recipientEmail" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GiftCardRedemption" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "giftCardId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftCardRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZatcaSubmission" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "status" "ZatcaSubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "zatcaUuid" TEXT,
    "qrCode" TEXT,
    "xmlHash" TEXT,
    "submittedAt" TIMESTAMP(3),
    "responseRaw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZatcaSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_bookingId_key" ON "Invoice"("bookingId");

-- CreateIndex
CREATE INDEX "Invoice_tenantId_idx" ON "Invoice"("tenantId");

-- CreateIndex
CREATE INDEX "Invoice_clientId_idx" ON "Invoice"("clientId");

-- CreateIndex
CREATE INDEX "Invoice_bookingId_idx" ON "Invoice"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Payment_tenantId_idx" ON "Payment"("tenantId");

-- CreateIndex
CREATE INDEX "Payment_invoiceId_idx" ON "Payment"("invoiceId");

-- CreateIndex
CREATE INDEX "Payment_gatewayRef_idx" ON "Payment"("gatewayRef");

-- CreateIndex
CREATE INDEX "Coupon_tenantId_idx" ON "Coupon"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_tenantId_code_key" ON "Coupon"("tenantId", "code");

-- CreateIndex
CREATE INDEX "CouponRedemption_tenantId_idx" ON "CouponRedemption"("tenantId");

-- CreateIndex
CREATE INDEX "CouponRedemption_invoiceId_idx" ON "CouponRedemption"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "CouponRedemption_couponId_invoiceId_key" ON "CouponRedemption"("couponId", "invoiceId");

-- CreateIndex
CREATE INDEX "GiftCard_tenantId_idx" ON "GiftCard"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCard_tenantId_code_key" ON "GiftCard"("tenantId", "code");

-- CreateIndex
CREATE INDEX "GiftCardRedemption_tenantId_idx" ON "GiftCardRedemption"("tenantId");

-- CreateIndex
CREATE INDEX "GiftCardRedemption_invoiceId_idx" ON "GiftCardRedemption"("invoiceId");

-- CreateIndex
CREATE INDEX "GiftCardRedemption_giftCardId_idx" ON "GiftCardRedemption"("giftCardId");

-- CreateIndex
CREATE UNIQUE INDEX "ZatcaSubmission_invoiceId_key" ON "ZatcaSubmission"("invoiceId");

-- CreateIndex
CREATE INDEX "ZatcaSubmission_tenantId_idx" ON "ZatcaSubmission"("tenantId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CouponRedemption" ADD CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GiftCardRedemption" ADD CONSTRAINT "GiftCardRedemption_giftCardId_fkey" FOREIGN KEY ("giftCardId") REFERENCES "GiftCard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ZatcaSubmission" ADD CONSTRAINT "ZatcaSubmission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
