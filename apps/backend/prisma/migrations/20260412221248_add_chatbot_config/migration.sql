-- CreateTable
CREATE TABLE "ChatbotConfig" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChatbotConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatbotConfig_tenantId_category_idx" ON "ChatbotConfig"("tenantId", "category");

-- CreateIndex
CREATE UNIQUE INDEX "ChatbotConfig_tenantId_key_key" ON "ChatbotConfig"("tenantId", "key");
