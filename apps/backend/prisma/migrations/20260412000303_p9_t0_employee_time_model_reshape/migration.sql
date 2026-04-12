/*
  Warnings:

  - You are about to drop the column `date` on the `EmployeeAvailabilityException` table. All the data in the column will be lost.
  - You are about to drop the column `endTime` on the `EmployeeAvailabilityException` table. All the data in the column will be lost.
  - You are about to drop the column `isOff` on the `EmployeeAvailabilityException` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `EmployeeAvailabilityException` table. All the data in the column will be lost.
  - Added the required column `endDate` to the `EmployeeAvailabilityException` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `EmployeeAvailabilityException` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "EmployeeAvailability_employeeId_dayOfWeek_key";

-- DropIndex
DROP INDEX "EmployeeAvailability_employeeId_idx";

-- DropIndex
DROP INDEX "EmployeeAvailabilityException_employeeId_date_key";

-- DropIndex
DROP INDEX "EmployeeAvailabilityException_employeeId_idx";

-- AlterTable
ALTER TABLE "EmployeeAvailabilityException" DROP COLUMN "date",
DROP COLUMN "endTime",
DROP COLUMN "isOff",
DROP COLUMN "startTime",
ADD COLUMN     "endDate" DATE NOT NULL,
ADD COLUMN     "startDate" DATE NOT NULL;

-- CreateIndex
CREATE INDEX "EmployeeAvailability_employeeId_dayOfWeek_idx" ON "EmployeeAvailability"("employeeId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "EmployeeAvailabilityException_employeeId_startDate_endDate_idx" ON "EmployeeAvailabilityException"("employeeId", "startDate", "endDate");
