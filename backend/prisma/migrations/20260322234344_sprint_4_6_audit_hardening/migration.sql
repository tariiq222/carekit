-- AlterEnum
ALTER TYPE "notification_type" ADD VALUE 'booking_completed';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "admin_notes" TEXT;
