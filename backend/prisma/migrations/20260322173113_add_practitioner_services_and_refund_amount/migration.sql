-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "refund_amount" INTEGER;

-- CreateTable
CREATE TABLE "practitioner_services" (
    "id" TEXT NOT NULL,
    "practitioner_id" TEXT NOT NULL,
    "service_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "practitioner_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "practitioner_services_service_id_idx" ON "practitioner_services"("service_id");

-- CreateIndex
CREATE UNIQUE INDEX "practitioner_services_practitioner_id_service_id_key" ON "practitioner_services"("practitioner_id", "service_id");

-- AddForeignKey
ALTER TABLE "practitioner_services" ADD CONSTRAINT "practitioner_services_practitioner_id_fkey" FOREIGN KEY ("practitioner_id") REFERENCES "practitioners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "practitioner_services" ADD CONSTRAINT "practitioner_services_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
