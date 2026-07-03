import db from "../db.server";

// ─── Types ───────────────────────────────────────────────────────────────────

export type DealWithRelations = Awaited<ReturnType<typeof getDealById>>;
export type PublicDeal = Awaited<ReturnType<typeof getActiveDealForProduct>>;

// ─── Read helpers ─────────────────────────────────────────────────────────────

/** Get all deals for a shop (list page) */
export async function getDealsByShop(shop: string) {
  return db.deal.findMany({
    where: { shop },
    orderBy: { updatedAt: "desc" },
    include: {
      tiers: { orderBy: { position: "asc" } },
      style: true,
    },
  });
}

/** Get single deal by ID */
export async function getDealById(id: string, shop: string) {
  return db.deal.findFirst({
    where: { id, shop },
    include: {
      tiers: { orderBy: { position: "asc" } },
      style: true,
    },
  });
}

/**
 * Get active deal for a given product on a given shop.
 * Used by the App Proxy (storefront widget fetch).
 * 
 * Priority: most-recently-updated active deal that targets this product.
 */
export async function getActiveDealForProduct(shop: string, productId: string) {
  const now = new Date();

  // 1. Try product-specific deal
  const productDeal = await db.deal.findFirst({
    where: {
      shop,
      status: "active",
      targetType: "products",
      targetIds: { has: productId },
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    },
    orderBy: { updatedAt: "desc" },
    include: {
      tiers: { orderBy: { position: "asc" } },
      style: true,
    },
  });
  if (productDeal) return productDeal;

  // 2. Fall back to "all products" deal
  const allDeal = await db.deal.findFirst({
    where: {
      shop,
      status: "active",
      targetType: "all",
      startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
      // Make sure this product is not excluded
      NOT: {
        excludeIds: { has: productId },
      },
    },
    orderBy: { updatedAt: "desc" },
    include: {
      tiers: { orderBy: { position: "asc" } },
      style: true,
    },
  });
  return allDeal;
}

// ─── Write helpers ────────────────────────────────────────────────────────────

export interface CreateDealInput {
  shop: string;
  name: string;
  blockTitle?: string;
  discountName?: string;
  dealType?: string;
  targetType?: string;
  targetIds?: string[];
  excludeIds?: string[];
  status?: string;
  startDate?: Date;
  endDate?: Date | null;
  showPricePerItem?: boolean;
  useCompareAtPrice?: boolean;
  skipCart?: boolean;
  allowVariantPerItem?: boolean;
  showVariantForSingle?: boolean;
  hideThemeVariantPicker?: boolean;
  hideUnavailableVariants?: boolean;
}

export interface TierInput {
  label: string;
  quantity: number;
  discountType: string;
  discountValue: number;
  badge?: string;
  isBadgeEnabled?: boolean;
  scratchOff?: boolean;
  position: number;
}

export interface StyleInput {
  layoutPreset?: string;
  cornerRadius?: number;
  spacing?: number;
  cardsBg?: string;
  selectedBg?: string;
  borderColor?: string;
  blockTitleColor?: string;
  titleColor?: string;
  subtitleColor?: string;
  priceColor?: string;
  fullPriceColor?: string;
  labelBg?: string;
  labelText?: string;
  badgeBg?: string;
  badgeText?: string;
  blockTitleSize?: number;
  blockTitleStyle?: string;
  titleSize?: number;
  titleStyle?: string;
  subtitleSize?: number;
  subtitleStyle?: string;
  labelSize?: number;
  labelStyle?: string;
}

/** Create a new deal with tiers + style */
export async function createDeal(
  input: CreateDealInput,
  tiers: TierInput[],
  style: StyleInput
) {
  return db.deal.create({
    data: {
      ...input,
      tiers: {
        create: tiers.map((t, i) => ({
          ...t,
          position: t.position ?? i,
        })),
      },
      style: {
        create: style,
      },
    },
    include: {
      tiers: { orderBy: { position: "asc" } },
      style: true,
    },
  });
}

/** Update a deal (and optionally replace tiers and style) */
export async function updateDeal(
  id: string,
  shop: string,
  input: Partial<CreateDealInput>,
  tiers?: TierInput[],
  style?: StyleInput
) {
  // If tiers provided, delete old and recreate
  if (tiers) {
    await db.dealTier.deleteMany({ where: { dealId: id } });
  }

  return db.deal.update({
    where: { id },
    data: {
      ...input,
      ...(tiers
        ? {
            tiers: {
              create: tiers.map((t, i) => ({
                ...t,
                position: t.position ?? i,
              })),
            },
          }
        : {}),
      ...(style
        ? {
            style: {
              upsert: {
                create: style,
                update: style,
              },
            },
          }
        : {}),
    },
    include: {
      tiers: { orderBy: { position: "asc" } },
      style: true,
    },
  });
}

/** Delete a deal by id */
export async function deleteDeal(id: string, shop: string) {
  return db.deal.delete({ where: { id } });
}

/** Set deal status (active / paused / draft) */
export async function setDealStatus(
  id: string,
  shop: string,
  status: "active" | "draft" | "paused",
  shopifyDiscountId?: string
) {
  return db.deal.update({
    where: { id },
    data: { status, ...(shopifyDiscountId ? { shopifyDiscountId } : {}) },
  });
}
