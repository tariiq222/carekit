-- CreateTable: ServiceBookingConfig
-- Per-service booking type configuration.
-- bookingType stores 'in_person' | 'online' as text (dashboard convention).
-- Each (serviceId, bookingType) pair is unique.

CREATE TABLE "ServiceBookingConfig" (
  "id"           TEXT          NOT NULL,
  "tenantId"     TEXT          NOT NULL,
  "serviceId"    TEXT          NOT NULL,
  "bookingType"  TEXT          NOT NULL,
  "price"        DECIMAL(12,2) NOT NULL DEFAULT 0,
  "durationMins" INTEGER       NOT NULL DEFAULT 30,
  "isActive"     BOOLEAN       NOT NULL DEFAULT true,
  "createdAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ServiceBookingConfig_pkey"                      PRIMARY KEY ("id"),
  CONSTRAINT "ServiceBookingConfig_serviceId_bookingType_key" UNIQUE ("serviceId", "bookingType"),
  CONSTRAINT "ServiceBookingConfig_bookingType_check"
    CHECK ("bookingType" IN ('in_person', 'online')),
  CONSTRAINT "ServiceBookingConfig_serviceId_fkey"
    FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ServiceBookingConfig_tenantId_idx"  ON "ServiceBookingConfig"("tenantId");
CREATE INDEX "ServiceBookingConfig_serviceId_idx" ON "ServiceBookingConfig"("serviceId");
