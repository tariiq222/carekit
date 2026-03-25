-- CreateTable
CREATE TABLE "practitioner_branches" (
    "id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "practitioner_branches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "practitioner_branches_branch_id_idx" ON "practitioner_branches"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "practitioner_branches_practitioner_id_branch_id_key" ON "practitioner_branches"("practitioner_id", "branch_id");

-- AddForeignKey
ALTER TABLE "practitioner_branches" ADD CONSTRAINT "practitioner_branches_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_branches" ADD CONSTRAINT "practitioner_branches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
