-- NOTE: Prisma's diff engine emitted DROP INDEX for DocumentChunk_embedding_cosine_idx
-- because it can't represent ivfflat in schema.prisma. Removed manually.
-- The index is re-asserted by prisma/hooks/ensure_vector_indexes.sql which runs
-- automatically after every `npm run prisma:migrate` / `prisma:migrate:deploy`.

-- CreateTable
CREATE TABLE "ServiceDurationOption" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "bookingType" "BookingType",
    "label" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "durationMins" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SAR',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceDurationOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceDurationOption_tenantId_idx" ON "ServiceDurationOption"("tenantId");

-- CreateIndex
CREATE INDEX "ServiceDurationOption_serviceId_idx" ON "ServiceDurationOption"("serviceId");

-- CreateIndex
CREATE INDEX "ServiceDurationOption_serviceId_bookingType_idx" ON "ServiceDurationOption"("serviceId", "bookingType");

-- AddForeignKey
ALTER TABLE "ServiceDurationOption" ADD CONSTRAINT "ServiceDurationOption_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;
