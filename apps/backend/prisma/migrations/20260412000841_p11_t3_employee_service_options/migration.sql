-- NOTE: DROP INDEX for DocumentChunk_embedding_cosine_idx removed (Prisma drift — see prisma/hooks/ensure_vector_indexes.sql).

-- CreateTable
CREATE TABLE "EmployeeServiceOption" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeServiceId" TEXT NOT NULL,
    "durationOptionId" TEXT NOT NULL,
    "priceOverride" DECIMAL(12,2),
    "durationOverride" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeServiceOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeServiceOption_tenantId_idx" ON "EmployeeServiceOption"("tenantId");

-- CreateIndex
CREATE INDEX "EmployeeServiceOption_employeeServiceId_idx" ON "EmployeeServiceOption"("employeeServiceId");

-- CreateIndex
CREATE INDEX "EmployeeServiceOption_durationOptionId_idx" ON "EmployeeServiceOption"("durationOptionId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeServiceOption_employeeServiceId_durationOptionId_key" ON "EmployeeServiceOption"("employeeServiceId", "durationOptionId");

-- AddForeignKey
ALTER TABLE "EmployeeServiceOption" ADD CONSTRAINT "EmployeeServiceOption_durationOptionId_fkey" FOREIGN KEY ("durationOptionId") REFERENCES "ServiceDurationOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
