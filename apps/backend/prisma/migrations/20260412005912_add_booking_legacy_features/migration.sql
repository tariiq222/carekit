-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'CANCEL_REQUESTED';

-- AlterEnum
ALTER TYPE "BookingType" ADD VALUE 'ONLINE';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "couponCode" TEXT,
ADD COLUMN     "discountedPrice" DECIMAL(12,2),
ADD COLUMN     "giftCardCode" TEXT,
ADD COLUMN     "payAtClinic" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "zoomHostUrl" TEXT,
ADD COLUMN     "zoomJoinUrl" TEXT,
ADD COLUMN     "zoomMeetingId" TEXT;

-- AlterTable
ALTER TABLE "BookingSettings" ADD COLUMN     "autoRefundOnCancel" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "payAtClinicEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "requireCancelApproval" BOOLEAN NOT NULL DEFAULT false;
