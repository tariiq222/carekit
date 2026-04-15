-- AddBranchFlags: isMain and timezone fields to Branch
-- This enables the "main branch" concept and per-branch timezone configuration

-- Add isMain BOOLEAN NOT NULL DEFAULT false
ALTER TABLE "Branch" ADD COLUMN "isMain" BOOLEAN NOT NULL DEFAULT false;

-- Add timezone TEXT NOT NULL DEFAULT 'Asia/Riyadh'
ALTER TABLE "Branch" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh';

-- Note: A partial unique index to enforce "one main branch per tenant" can be added separately
-- when the business logic for setting a new primary branch is implemented.
-- Example: CREATE UNIQUE INDEX "Branch_tenant_main" ON "Branch"("tenantId") WHERE "isMain" = true;