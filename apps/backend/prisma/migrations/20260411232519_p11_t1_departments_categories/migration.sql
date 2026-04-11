-- NOTE: Prisma's diff engine wanted to DROP the DocumentChunk ivfflat index here
-- because it's defined in raw SQL (migration 20260411232059) and not in schema.prisma.
-- That drop has been removed intentionally — the index is load-bearing for pgvector
-- similarity search (p11 AI knowledge base). Leave it alone.

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "departmentId" TEXT,
    "nameAr" TEXT NOT NULL,
    "nameEn" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Department_tenantId_idx" ON "Department"("tenantId");

-- CreateIndex
CREATE INDEX "Department_tenantId_isActive_idx" ON "Department"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "ServiceCategory_tenantId_idx" ON "ServiceCategory"("tenantId");

-- CreateIndex
CREATE INDEX "ServiceCategory_tenantId_isActive_idx" ON "ServiceCategory"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "ServiceCategory_departmentId_idx" ON "ServiceCategory"("departmentId");

-- CreateIndex
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");

-- AddForeignKey
ALTER TABLE "ServiceCategory" ADD CONSTRAINT "ServiceCategory_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Ensure pgvector index survives Prisma drift detection (see prisma/hooks/ensure_vector_indexes.sql).
CREATE INDEX IF NOT EXISTS "DocumentChunk_embedding_cosine_idx"
  ON "DocumentChunk"
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
