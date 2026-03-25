-- AlterTable
ALTER TABLE "booking_settings" ADD COLUMN     "cancellation_review_timeout_hours" INTEGER NOT NULL DEFAULT 48,
ADD COLUMN     "no_show_policy" TEXT NOT NULL DEFAULT 'keep_full',
ADD COLUMN     "no_show_refund_percent" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "booking_status_logs" (
    "id" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "changed_by" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_status_logs_booking_id_idx" ON "booking_status_logs"("booking_id");

-- CreateIndex
CREATE INDEX "booking_status_logs_created_at_idx" ON "booking_status_logs"("created_at");

-- AddForeignKey
ALTER TABLE "booking_status_logs" ADD CONSTRAINT "booking_status_logs_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
