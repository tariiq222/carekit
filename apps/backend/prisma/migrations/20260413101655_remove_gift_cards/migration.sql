-- Drop gift card feature: tables, FK, column on Booking, and enum value.

ALTER TABLE "GiftCardRedemption" DROP CONSTRAINT IF EXISTS "GiftCardRedemption_giftCardId_fkey";

DROP INDEX IF EXISTS "GiftCardRedemption_giftCardId_idx";
DROP INDEX IF EXISTS "GiftCardRedemption_invoiceId_idx";
DROP INDEX IF EXISTS "GiftCardRedemption_tenantId_idx";
DROP INDEX IF EXISTS "GiftCard_tenantId_code_key";
DROP INDEX IF EXISTS "GiftCard_tenantId_idx";

DROP TABLE IF EXISTS "GiftCardRedemption";
DROP TABLE IF EXISTS "GiftCard";

ALTER TABLE "Booking" DROP COLUMN IF EXISTS "giftCardCode";

-- Recreate PaymentMethod enum without GIFT_CARD.
-- Any existing rows using GIFT_CARD are migrated to CASH as a neutral fallback;
-- the feature never shipped a controller/UI so production rows are not expected.
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";

CREATE TYPE "PaymentMethod" AS ENUM ('ONLINE_CARD', 'BANK_TRANSFER', 'CASH', 'COUPON');

ALTER TABLE "Payment"
  ALTER COLUMN "method" TYPE "PaymentMethod"
  USING (
    CASE "method"::text
      WHEN 'GIFT_CARD' THEN 'CASH'::"PaymentMethod"
      ELSE "method"::text::"PaymentMethod"
    END
  );

DROP TYPE "PaymentMethod_old";
