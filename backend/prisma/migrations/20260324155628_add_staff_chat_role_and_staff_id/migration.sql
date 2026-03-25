-- AlterEnum
ALTER TYPE "chat_role" ADD VALUE 'staff';

-- AlterTable
ALTER TABLE "chat_messages" ADD COLUMN     "staff_id" TEXT;
