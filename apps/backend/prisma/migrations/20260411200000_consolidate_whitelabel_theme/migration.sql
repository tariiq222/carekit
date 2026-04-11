-- AlterTable
ALTER TABLE "clinic_settings" DROP COLUMN "theme";

-- AlterTable
ALTER TABLE "white_label_config" DROP COLUMN "primary_color",
DROP COLUMN "secondary_color",
ADD COLUMN     "color_accent" TEXT NOT NULL DEFAULT '#82CC17',
ADD COLUMN     "color_accent_dark" TEXT NOT NULL DEFAULT '#5A9010',
ADD COLUMN     "color_background" TEXT NOT NULL DEFAULT '#EEF1F8',
ADD COLUMN     "color_primary" TEXT NOT NULL DEFAULT '#354FD8',
ADD COLUMN     "color_primary_dark" TEXT NOT NULL DEFAULT '#2438B0',
ADD COLUMN     "color_primary_light" TEXT NOT NULL DEFAULT '#5B72E8',
ADD COLUMN     "font_url" TEXT,
ADD COLUMN     "product_tagline" TEXT,
ALTER COLUMN "font_family" SET DEFAULT 'IBM Plex Sans Arabic';
