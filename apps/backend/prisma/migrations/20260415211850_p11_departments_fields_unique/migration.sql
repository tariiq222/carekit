-- AlterTable: add new optional fields
ALTER TABLE "Department" ADD COLUMN     "descriptionAr" TEXT,
ADD COLUMN     "descriptionEn" TEXT,
ADD COLUMN     "icon" TEXT;

-- Deduplicate existing rows before creating unique index
-- Keep the row with the earliest createdAt per (tenantId, nameAr), delete the rest
DELETE FROM "Department"
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY "tenantId", "nameAr" ORDER BY "createdAt" ASC) AS rn
    FROM "Department"
  ) ranked
  WHERE rn > 1
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_tenantId_nameAr_key" ON "Department"("tenantId", "nameAr");
