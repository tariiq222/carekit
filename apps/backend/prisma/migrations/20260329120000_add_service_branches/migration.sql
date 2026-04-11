-- CreateTable
CREATE TABLE "service_branches" (
    "id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_branches_service_id_branch_id_key" ON "service_branches"("service_id", "branch_id");

-- CreateIndex
CREATE INDEX "service_branches_branch_id_idx" ON "service_branches"("branch_id");

-- AddForeignKey
ALTER TABLE "service_branches" ADD CONSTRAINT "service_branches_service_id_fkey"
    FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_branches" ADD CONSTRAINT "service_branches_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
