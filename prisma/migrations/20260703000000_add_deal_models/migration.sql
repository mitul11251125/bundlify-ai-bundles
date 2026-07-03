-- CreateTable: Deal
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "blockTitle" TEXT NOT NULL DEFAULT 'BUNDLE & SAVE',
    "discountName" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "dealType" TEXT NOT NULL DEFAULT 'quantity_breaks',
    "targetType" TEXT NOT NULL DEFAULT 'all',
    "targetIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "excludeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "markets" TEXT NOT NULL DEFAULT 'all',
    "excludeB2B" BOOLEAN NOT NULL DEFAULT false,
    "showPricePerItem" BOOLEAN NOT NULL DEFAULT false,
    "useCompareAtPrice" BOOLEAN NOT NULL DEFAULT true,
    "skipCart" BOOLEAN NOT NULL DEFAULT false,
    "allowVariantPerItem" BOOLEAN NOT NULL DEFAULT true,
    "showVariantForSingle" BOOLEAN NOT NULL DEFAULT true,
    "hideThemeVariantPicker" BOOLEAN NOT NULL DEFAULT false,
    "hideUnavailableVariants" BOOLEAN NOT NULL DEFAULT false,
    "shopifyDiscountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DealTier
CREATE TABLE "DealTier" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "label" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "discountType" TEXT NOT NULL DEFAULT 'percentage',
    "discountValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "badge" TEXT,
    "isBadgeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scratchOff" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DealTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable: DealStyle
CREATE TABLE "DealStyle" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "layoutPreset" TEXT NOT NULL DEFAULT 'card',
    "cornerRadius" INTEGER NOT NULL DEFAULT 8,
    "spacing" INTEGER NOT NULL DEFAULT 10,
    "cardsBg" TEXT NOT NULL DEFAULT '#ffffff',
    "selectedBg" TEXT NOT NULL DEFAULT '#f0f5ff',
    "borderColor" TEXT NOT NULL DEFAULT '#000000',
    "blockTitleColor" TEXT NOT NULL DEFAULT '#000000',
    "titleColor" TEXT NOT NULL DEFAULT '#000000',
    "subtitleColor" TEXT NOT NULL DEFAULT '#6d7175',
    "priceColor" TEXT NOT NULL DEFAULT '#000000',
    "fullPriceColor" TEXT NOT NULL DEFAULT '#8c9196',
    "labelBg" TEXT NOT NULL DEFAULT '#e3e3e3',
    "labelText" TEXT NOT NULL DEFAULT '#000000',
    "badgeBg" TEXT NOT NULL DEFAULT '#000000',
    "badgeText" TEXT NOT NULL DEFAULT '#ffffff',
    "blockTitleSize" INTEGER NOT NULL DEFAULT 14,
    "blockTitleStyle" TEXT NOT NULL DEFAULT 'bold',
    "titleSize" INTEGER NOT NULL DEFAULT 20,
    "titleStyle" TEXT NOT NULL DEFAULT 'bold',
    "subtitleSize" INTEGER NOT NULL DEFAULT 14,
    "subtitleStyle" TEXT NOT NULL DEFAULT 'regular',
    "labelSize" INTEGER NOT NULL DEFAULT 12,
    "labelStyle" TEXT NOT NULL DEFAULT 'regular',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DealStyle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deal_shop_idx" ON "Deal"("shop");
CREATE INDEX "Deal_shop_status_idx" ON "Deal"("shop", "status");
CREATE INDEX "DealTier_dealId_idx" ON "DealTier"("dealId");
CREATE UNIQUE INDEX "DealStyle_dealId_key" ON "DealStyle"("dealId");

-- AddForeignKey
ALTER TABLE "DealTier" ADD CONSTRAINT "DealTier_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DealStyle" ADD CONSTRAINT "DealStyle_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
