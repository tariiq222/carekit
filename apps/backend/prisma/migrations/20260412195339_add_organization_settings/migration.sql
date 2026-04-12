-- CreateTable
CREATE TABLE "OrganizationSettings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "companyNameAr" TEXT,
    "companyNameEn" TEXT,
    "businessRegistration" TEXT,
    "vatRegistrationNumber" TEXT,
    "vatRate" DECIMAL(5,4) NOT NULL DEFAULT 0.15,
    "sellerAddress" TEXT,
    "organizationCity" TEXT NOT NULL DEFAULT 'Riyadh',
    "postalCode" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "address" TEXT,
    "socialMedia" JSONB,
    "aboutAr" TEXT,
    "aboutEn" TEXT,
    "privacyPolicyAr" TEXT,
    "privacyPolicyEn" TEXT,
    "termsAr" TEXT,
    "termsEn" TEXT,
    "cancellationPolicyAr" TEXT,
    "cancellationPolicyEn" TEXT,
    "defaultLanguage" TEXT NOT NULL DEFAULT 'ar',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Riyadh',
    "weekStartDay" TEXT NOT NULL DEFAULT 'sunday',
    "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
    "timeFormat" TEXT NOT NULL DEFAULT '12h',
    "emailHeaderShowLogo" BOOLEAN NOT NULL DEFAULT true,
    "emailHeaderShowName" BOOLEAN NOT NULL DEFAULT true,
    "emailFooterPhone" TEXT,
    "emailFooterWebsite" TEXT,
    "emailFooterInstagram" TEXT,
    "emailFooterTwitter" TEXT,
    "emailFooterSnapchat" TEXT,
    "emailFooterTiktok" TEXT,
    "emailFooterLinkedin" TEXT,
    "emailFooterYoutube" TEXT,
    "sessionDuration" INTEGER NOT NULL DEFAULT 60,
    "reminderBeforeMinutes" INTEGER NOT NULL DEFAULT 60,
    "bookingFlowOrder" TEXT NOT NULL DEFAULT 'service_first',
    "paymentMoyasarEnabled" BOOLEAN NOT NULL DEFAULT true,
    "paymentAtClinicEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSettings_tenantId_key" ON "OrganizationSettings"("tenantId");

-- CreateIndex
CREATE INDEX "OrganizationSettings_tenantId_idx" ON "OrganizationSettings"("tenantId");
