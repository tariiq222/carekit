ALTER TABLE "SubscriptionInvoice"
  ADD COLUMN "invoiceNumber" TEXT,
  ADD COLUMN "invoiceHash" TEXT,
  ADD COLUMN "previousHash" TEXT,
  ADD COLUMN "pdfStorageKey" TEXT;

CREATE UNIQUE INDEX "SubscriptionInvoice_invoiceNumber_key" ON "SubscriptionInvoice"("invoiceNumber");
CREATE INDEX "SubscriptionInvoice_organizationId_issuedAt_idx" ON "SubscriptionInvoice"("organizationId", "issuedAt");
CREATE INDEX "SubscriptionInvoice_organizationId_invoiceNumber_idx" ON "SubscriptionInvoice"("organizationId", "invoiceNumber");

CREATE TABLE "OrganizationInvoiceCounter" (
  "organizationId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "lastSequence" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrganizationInvoiceCounter_pkey" PRIMARY KEY ("organizationId", "year")
);

CREATE INDEX "OrganizationInvoiceCounter_organizationId_idx" ON "OrganizationInvoiceCounter"("organizationId");

ALTER TABLE "OrganizationInvoiceCounter"
  ADD CONSTRAINT "OrganizationInvoiceCounter_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
