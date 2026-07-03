import { useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useSubmit } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import type { HeadersFunction } from "react-router";
import {
  createDeal,
  updateDeal,
  getDealById,
  setDealStatus,
} from "../models/deal.server";

// Import custom icons
import eyeIcon from "../../src/icons/eye.png?dataurl";
import questionIcon from "../../src/icons/question.png?dataurl";
import settingsIcon from "../../src/icons/settings.png?dataurl";
import gridIcon from "../../src/icons/grid.png?dataurl";
import megaphoneIcon from "../../src/icons/megaphone.png?dataurl";
import plusIcon from "../../src/icons/plus.png?dataurl";
import checkIcon from "../../src/icons/check.png?dataurl";
import lockIcon from "../../src/icons/lock.png?dataurl";
import globeIcon from "../../src/icons/globe.png?dataurl";
import powerIcon from "../../src/icons/power.png?dataurl";
import starIcon from "../../src/icons/star.png?dataurl";
import coinsIcon from "../../src/icons/coins.png?dataurl";
import groupIcon from "../../src/icons/group.png?dataurl";
import listIcon from "../../src/icons/list.png?dataurl";

// ─── Types ───────────────────────────────────────────────────────────────────

type TierLocal = {
  id: string; // local uuid
  label: string;
  quantity: number;
  discountType: "percentage" | "fixed" | "price";
  discountValue: number;
  badge: string;
  isBadgeEnabled: boolean;
  scratchOff: boolean;
};

type StyleLocal = {
  layoutPreset: string;
  cornerRadius: number;
  spacing: number;
  cardsBg: string;
  selectedBg: string;
  borderColor: string;
  blockTitleColor: string;
  titleColor: string;
  subtitleColor: string;
  priceColor: string;
  fullPriceColor: string;
  labelBg: string;
  labelText: string;
  badgeBg: string;
  badgeText: string;
  blockTitleSize: number;
  blockTitleStyle: string;
  titleSize: number;
  titleStyle: string;
  subtitleSize: number;
  subtitleStyle: string;
  labelSize: number;
  labelStyle: string;
};

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const dealId = params.id;

  let deal = null;
  if (dealId && dealId !== "new") {
    deal = await getDealById(dealId, shop);
  }

  let targetDetails: Array<{ id: string; title: string; image?: string }> = [];
  if (deal?.targetIds && deal.targetIds.length > 0) {
    try {
      const response = await admin.graphql(
        `#graphql
        query getNodes($ids: [ID!]!) {
          nodes(ids: $ids) {
            id
            ... on Product {
              title
              featuredImage {
                url
              }
            }
            ... on Collection {
              title
              image {
                url
              }
            }
          }
        }`,
        {
          variables: {
            ids: deal.targetIds,
          },
        }
      );
      const resJson = await response.json();
      const nodes = resJson.data?.nodes || [];
      targetDetails = nodes
        .filter((n: any) => n !== null)
        .map((n: any) => ({
          id: n.id,
          title: n.title,
          image: n.featuredImage?.url || n.image?.url || "",
        }));
    } catch (e) {
      console.error("Error fetching target details in loader:", e);
    }
  }

  return { shop, deal, isNew: !dealId || dealId === "new", targetDetails };
};

// ─── Action ──────────────────────────────────────────────────────────────────

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "save" || intent === "publish") {
    const name = formData.get("name") as string;
    const blockTitle = formData.get("blockTitle") as string;
    const discountName = formData.get("discountName") as string;
    const dealType = formData.get("dealType") as string;
    const targetType = formData.get("targetType") as string;

    const tiersRaw = formData.get("tiers") as string;
    const styleRaw = formData.get("style") as string;
    const tiers = JSON.parse(tiersRaw || "[]");
    const style = JSON.parse(styleRaw || "{}");

    const dealId = params.id;
    const isNew = !dealId || dealId === "new";
    const status = intent === "publish" ? "active" : "draft";

    const dealInput = {
      shop,
      name: name || "Untitled Deal",
      blockTitle: blockTitle || "BUNDLE & SAVE",
      discountName: discountName || "",
      dealType: dealType || "quantity_breaks",
      targetType: targetType || "all",
      targetIds: JSON.parse(formData.get("targetIds") as string || "[]"),
      excludeIds: [],
      status,

      // Visibility & Settings
      excludeB2B: formData.get("excludeB2B") === "true",
      applyDiscountOnlyViaWidget: formData.get("applyDiscountOnlyViaWidget") === "true",
      markets: formData.get("markets") as string || "all",

      // Dates
      startDate: new Date(formData.get("startDate") as string),
      endDate: formData.get("setEndDate") === "true" && formData.get("endDate")
        ? new Date(formData.get("endDate") as string)
        : null,

      // Pricing options
      showPricePerItem: formData.get("showPricePerItem") === "true",
      useCompareAtPrice: formData.get("useCompareAtPrice") === "true",
      showPricesWithoutDecimals: formData.get("showPricesWithoutDecimals") === "true",
      priceRounding: formData.get("priceRounding") === "true",
      updateThemeProductPrice: formData.get("updateThemeProductPrice") === "true",
      skipCart: formData.get("skipCart") === "true",

      // Variant options  
      allowVariantPerItem: formData.get("allowVariantPerItem") === "true",
      hideThemeVariantPicker: formData.get("hideThemeVariantPicker") === "true",
      hideUnavailableVariants: formData.get("hideUnavailableVariants") === "true",
      dontUpdateOtherProducts: formData.get("dontUpdateOtherProducts") === "true",

      // Countdown Timer
      countdownEnabled: formData.get("countdownEnabled") === "true",
      countdownType: formData.get("countdownType") as string || "fixed",
      countdownText: formData.get("countdownText") as string || "Limited time offer ends in {{timer}}!",
      countdownDuration: Number(formData.get("countdownDuration") || "15"),
      countdownColor: formData.get("countdownColor") as string || "#ef4444",
      countdownBg: formData.get("countdownBg") as string || "#fef2f2",

      // Checkbox Upsells
      upsellsEnabled: formData.get("upsellsEnabled") === "true",
      upsellProduct: formData.get("upsellProduct") as string || "Extra Protection Warranty",
      upsellPrice: Number(formData.get("upsellPrice") || "4.99"),
      upsellText: formData.get("upsellText") as string || "Add {{product}} for just ${{price}}",

      // Progressive Gifts
      giftsEnabled: formData.get("giftsEnabled") === "true",
      giftThreshold: Number(formData.get("giftThreshold") || "75.0"),
      giftProduct: formData.get("giftProduct") as string || "Free Ceramic Spoon",
      giftText: formData.get("giftText") as string || "Spend ${{remaining}} more to get a {{gift}}!",

      // Sticky Cart
      stickyEnabled: formData.get("stickyEnabled") === "true",
      stickyText: formData.get("stickyText") as string || "Grab this bundle deal now!",
      stickyBtnText: formData.get("stickyBtnText") as string || "Add bundle",
      lowStockAlert: formData.get("lowStockAlert") === "true",
    };

    const tiersForDB = tiers.map((t: TierLocal, i: number) => ({
      label: t.label,
      quantity: t.quantity,
      discountType: t.discountType,
      discountValue: t.discountValue,
      badge: t.badge,
      isBadgeEnabled: t.isBadgeEnabled,
      scratchOff: t.scratchOff,
      position: i,
    }));

    let savedDeal;
    if (isNew) {
      savedDeal = await createDeal(dealInput, tiersForDB, style);
    } else {
      savedDeal = await updateDeal(dealId!, shop, dealInput, tiersForDB, style);
    }

    if (intent === "publish" && savedDeal.tiers.length > 0) {
      try {
        const firstTier = savedDeal.tiers[0];
        if (firstTier.discountType === "percentage" && firstTier.discountValue > 0) {
          const discountResponse = await admin.graphql(
            `#graphql
            mutation CreateAutomaticDiscount($automaticAppDiscount: DiscountAutomaticAppInput!) {
              discountAutomaticAppCreate(automaticAppDiscount: $automaticAppDiscount) {
                automaticAppDiscount {
                  discountId
                }
                userErrors {
                  field
                  message
                }
              }
            }`,
            {
              variables: {
                automaticAppDiscount: {
                  title: savedDeal.discountName || savedDeal.name,
                  functionId: process.env.SHOPIFY_DISCOUNT_FUNCTION_ID || "",
                  startsAt: new Date().toISOString(),
                  combinesWith: {
                    orderDiscounts: false,
                    productDiscounts: false,
                    shippingDiscounts: true,
                  },
                },
              },
            }
          );

          const discountData = await discountResponse.json();
          const discountId =
            discountData?.data?.discountAutomaticAppCreate?.automaticAppDiscount?.discountId;

          if (discountId) {
            await setDealStatus(savedDeal.id, shop, "active", discountId);
          }
        } else {
          await setDealStatus(savedDeal.id, shop, "active");
        }
      } catch (discountErr) {
        console.error("[Configurator] Error creating discount:", discountErr);
        await setDealStatus(savedDeal.id, shop, "active");
      }
    }

    return {
      ok: true,
      dealId: savedDeal.id,
      status,
    };
  }

  return { ok: false };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_STYLE: StyleLocal = {
  layoutPreset: "card",
  cornerRadius: 8,
  spacing: 10,
  cardsBg: "#ffffff",
  selectedBg: "#ffffff",
  borderColor: "#000000",
  blockTitleColor: "#1a1a1a",
  titleColor: "#1a1a1a",
  subtitleColor: "#6d7175",
  priceColor: "#1a1a1a",
  fullPriceColor: "#8c9196",
  labelBg: "#e3e3e3",
  labelText: "#1a1a1a",
  badgeBg: "#000000",
  badgeText: "#ffffff",
  blockTitleSize: 13,
  blockTitleStyle: "bold",
  titleSize: 15,
  titleStyle: "bold",
  subtitleSize: 13,
  subtitleStyle: "regular",
  labelSize: 11,
  labelStyle: "regular",
};

const DEFAULT_TIERS: TierLocal[] = [
  {
    id: uid(),
    label: "Buy 1, get 1 free",
    quantity: 2,
    discountType: "percentage",
    discountValue: 50,
    badge: "",
    isBadgeEnabled: false,
    scratchOff: false,
  },
  {
    id: uid(),
    label: "Buy 2, get 3 free",
    quantity: 5,
    discountType: "percentage",
    discountValue: 60,
    badge: "",
    isBadgeEnabled: false,
    scratchOff: false,
  },
  {
    id: uid(),
    label: "Buy 3, get 6 free",
    quantity: 9,
    discountType: "percentage",
    discountValue: 66,
    badge: "",
    isBadgeEnabled: false,
    scratchOff: false,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function BundleConfigurator() {
  const { deal, targetDetails = [] } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const submit = useSubmit();

  // ── Main deal state ──
  const [name, setName] = useState(deal?.name || "My Bundle Deal");
  const [blockTitle, setBlockTitle] = useState(deal?.blockTitle || "BUNDLE & SAVE");
  const [discountName, setDiscountName] = useState(deal?.discountName || "");
  const [dealType, setDealType] = useState(deal?.dealType || "quantity_breaks");
  const [targetType, setTargetType] = useState(deal?.targetType || "all");

  // ── Target Resource Selection state ──
  const [targetIds, setTargetIds] = useState<string[]>(deal?.targetIds || []);
  const [selectedResources, setSelectedResources] = useState<Array<{ id: string; title: string; image?: string }>>(targetDetails);

  // ── Tiers ──
  const [tiers, setTiers] = useState<TierLocal[]>(
    deal?.tiers?.length
      ? deal.tiers.map((t: any) => ({
          id: uid(),
          label: t.label,
          quantity: t.quantity,
          discountType: t.discountType as TierLocal["discountType"],
          discountValue: t.discountValue,
          badge: t.badge || "",
          isBadgeEnabled: t.isBadgeEnabled,
          scratchOff: t.scratchOff || false,
        }))
      : DEFAULT_TIERS
  );
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

  // ── Advanced Features state ──
  const [countdownEnabled, setCountdownEnabled] = useState(deal?.countdownEnabled || false);
  const [countdownType, setCountdownType] = useState(deal?.countdownType || "fixed");
  const [countdownText, setCountdownText] = useState(deal?.countdownText || "Limited time offer ends in {{timer}}!");
  const [countdownDuration, setCountdownDuration] = useState(deal?.countdownDuration || 15);
  const [countdownColor, setCountdownColor] = useState(deal?.countdownColor || "#ef4444");
  const [countdownBg, setCountdownBg] = useState(deal?.countdownBg || "#fef2f2");

  const [upsellsEnabled, setUpsellsEnabled] = useState(deal?.upsellsEnabled || false);
  const [upsellProduct, setUpsellProduct] = useState(deal?.upsellProduct || "Extra Protection Warranty");
  const [upsellPrice, setUpsellPrice] = useState(deal?.upsellPrice || 4.99);
  const [upsellText, setUpsellText] = useState(deal?.upsellText || "Add {{product}} for just ${{price}}");

  const [giftsEnabled, setGiftsEnabled] = useState(deal?.giftsEnabled || false);
  const [giftThreshold, setGiftThreshold] = useState(deal?.giftThreshold || 75.0);
  const [giftProduct, setGiftProduct] = useState(deal?.giftProduct || "Free Ceramic Spoon");
  const [giftText, setGiftText] = useState(deal?.giftText || "Spend ${{remaining}} more to get a {{gift}}!");

  const [stickyEnabled, setStickyEnabled] = useState(deal?.stickyEnabled || false);
  const [stickyText, setStickyText] = useState(deal?.stickyText || "Grab this bundle deal now!");
  const [stickyBtnText, setStickyBtnText] = useState(deal?.stickyBtnText || "Add bundle");

  // ── Visibility & Settings states ──
  const [excludeB2B, setExcludeB2B] = useState(deal?.excludeB2B || false);
  const [applyDiscountOnlyViaWidget, setApplyDiscountOnlyViaWidget] = useState(deal?.applyDiscountOnlyViaWidget || false);
  const [markets, setMarkets] = useState(deal?.markets || "all");

  // ── Active dates states ──
  const [startDate, setStartDate] = useState(deal?.startDate ? new Date(deal.startDate).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = useState(deal?.startDate ? new Date(deal.startDate).toTimeString().slice(0, 5) : "12:00");
  const [setEndDate, setSetEndDate] = useState(!!deal?.endDate);
  const [endDate, setEndDateVal] = useState(deal?.endDate ? new Date(deal.endDate).toISOString().split("T")[0] : new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0]);
  const [endTime, setEndTimeVal] = useState(deal?.endDate ? new Date(deal.endDate).toTimeString().slice(0, 5) : "12:00");

  // ── Variants states ──
  const [allowVariantPerItem, setAllowVariantPerItem] = useState(deal?.allowVariantPerItem ?? true);
  const [hideThemeVariantPicker, setHideThemeVariantPicker] = useState(deal?.hideThemeVariantPicker || false);
  const [hideUnavailableVariants, setHideUnavailableVariants] = useState(deal?.hideUnavailableVariants || false);
  const [dontUpdateOtherProducts, setDontUpdateOtherProducts] = useState(deal?.dontUpdateOtherProducts || false);

  // ── Pricing states ──
  const [showPricePerItem, setShowPricePerItem] = useState(deal?.showPricePerItem || false);
  const [useCompareAtPrice, setUseCompareAtPrice] = useState(deal?.useCompareAtPrice ?? true);
  const [showPricesWithoutDecimals, setShowPricesWithoutDecimals] = useState(deal?.showPricesWithoutDecimals || false);
  const [priceRounding, setPriceRounding] = useState(deal?.priceRounding || false);
  const [updateThemeProductPrice, setUpdateThemeProductPrice] = useState(deal?.updateThemeProductPrice || false);

  // ── Cart & Alerts states ──
  const [skipCart, setSkipCart] = useState(deal?.skipCart || false);
  const [lowStockAlert, setLowStockAlert] = useState(deal?.lowStockAlert || false);

  const [volumeDiscountEnabled, setVolumeDiscountEnabled] = useState(false);
  const [scratchOffEnabled, setScratchOffEnabled] = useState(false);
  const [subscriptionsEnabled, setSubscriptionsEnabled] = useState(false);

  // ── Style ──
  const [style, setStyle] = useState<StyleLocal>(
    deal?.style
      ? {
          layoutPreset: deal.style.layoutPreset,
          cornerRadius: deal.style.cornerRadius,
          spacing: deal.style.spacing,
          cardsBg: deal.style.cardsBg,
          selectedBg: deal.style.selectedBg,
          borderColor: deal.style.borderColor,
          blockTitleColor: deal.style.blockTitleColor,
          titleColor: deal.style.titleColor,
          subtitleColor: deal.style.subtitleColor,
          priceColor: deal.style.priceColor,
          fullPriceColor: deal.style.fullPriceColor,
          labelBg: deal.style.labelBg,
          labelText: deal.style.labelText,
          badgeBg: deal.style.badgeBg,
          badgeText: deal.style.badgeText,
          blockTitleSize: deal.style.blockTitleSize,
          blockTitleStyle: deal.style.blockTitleStyle,
          titleSize: deal.style.titleSize,
          titleStyle: deal.style.titleStyle,
          subtitleSize: deal.style.subtitleSize,
          subtitleStyle: deal.style.subtitleStyle,
          labelSize: deal.style.labelSize,
          labelStyle: deal.style.labelStyle,
        }
      : DEFAULT_STYLE
  );

  const [openSection, setOpenSection] = useState<string>("tiers");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [previewSelected, setPreviewSelected] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // ── Preview States ──
  const [previewProduct, setPreviewProduct] = useState("Classic Ceramic Mug");
  const [previewCountry, setPreviewCountry] = useState("United States");

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const openProductPicker = async () => {
    try {
      const selected = await shopify.resourcePicker({
        type: "product",
        multiple: true,
        action: "select",
        selectionIds: targetIds.map((id) => ({ id })),
      });
      if (selected) {
        const ids = selected.map((p: any) => p.id);
        const resources = selected.map((p: any) => ({
          id: p.id,
          title: p.title,
          image: p.images?.[0]?.originalSource || p.featuredImage?.url || "",
        }));
        setTargetIds(ids);
        setSelectedResources(resources);
      }
    } catch (err) {
      console.error("Resource picker error:", err);
    }
  };

  const openCollectionPicker = async () => {
    try {
      const selected = await shopify.resourcePicker({
        type: "collection",
        multiple: true,
        action: "select",
        selectionIds: targetIds.map((id) => ({ id })),
      });
      if (selected) {
        const ids = selected.map((c: any) => c.id);
        const resources = selected.map((c: any) => ({
          id: c.id,
          title: c.title,
          image: c.image?.url || "",
        }));
        setTargetIds(ids);
        setSelectedResources(resources);
      }
    } catch (err) {
      console.error("Resource picker error:", err);
    }
  };

  const removeResource = (idToRemove: string) => {
    setTargetIds((prev) => prev.filter((id) => id !== idToRemove));
    setSelectedResources((prev) => prev.filter((r) => r.id !== idToRemove));
  };

  const addTier = () => {
    setTiers([
      ...tiers,
      {
        id: uid(),
        label: `Pack of ${tiers.length + 1}`,
        quantity: tiers.length + 1,
        discountType: "percentage",
        discountValue: (tiers.length + 1) * 5,
        badge: "",
        isBadgeEnabled: false,
        scratchOff: false,
      },
    ]);
  };

  const removeTier = (id: string) => {
    if (tiers.length <= 1) return;
    setTiers(tiers.filter((t) => t.id !== id));
  };

  const updateTier = (id: string, patch: Partial<TierLocal>) => {
    setTiers(tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };

  const moveTierUp = (index: number) => {
    if (index === 0) return;
    const next = [...tiers];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    setTiers(next);
  };

  const moveTierDown = (index: number) => {
    if (index === tiers.length - 1) return;
    const next = [...tiers];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    setTiers(next);
  };

  const updateStyle = (patch: Partial<StyleLocal>) => {
    setStyle((s) => ({ ...s, ...patch }));
  };

  const handleSave = useCallback(
    async (intentVal: "save" | "publish") => {
      if (intentVal === "publish") setIsPublishing(true);
      else setIsSaving(true);

      const fd = new FormData();
      fd.append("intent", intentVal);
      fd.append("name", name);
      fd.append("blockTitle", blockTitle);
      fd.append("discountName", discountName);
      fd.append("dealType", dealType);
      fd.append("targetType", targetType);
      fd.append("targetIds", JSON.stringify(targetIds));
      fd.append("tiers", JSON.stringify(tiers));
      fd.append("style", JSON.stringify(style));

      fd.append("countdownEnabled", String(countdownEnabled));
      fd.append("countdownType", countdownType);
      fd.append("countdownText", countdownText);
      fd.append("countdownDuration", String(countdownDuration));
      fd.append("countdownColor", countdownColor);
      fd.append("countdownBg", countdownBg);

      fd.append("upsellsEnabled", String(upsellsEnabled));
      fd.append("upsellProduct", upsellProduct);
      fd.append("upsellPrice", String(upsellPrice));
      fd.append("upsellText", upsellText);

      fd.append("giftsEnabled", String(giftsEnabled));
      fd.append("giftThreshold", String(giftThreshold));
      fd.append("giftProduct", giftProduct);
      fd.append("giftText", giftText);

      fd.append("stickyEnabled", String(stickyEnabled));
      fd.append("stickyText", stickyText);
      fd.append("stickyBtnText", stickyBtnText);

      // Visibility & Settings
      fd.append("excludeB2B", String(excludeB2B));
      fd.append("applyDiscountOnlyViaWidget", String(applyDiscountOnlyViaWidget));
      fd.append("markets", markets);

      // Dates
      const startDateTime = new Date(`${startDate}T${startTime}:00`).toISOString();
      fd.append("startDate", startDateTime);
      fd.append("setEndDate", String(setEndDate));
      if (setEndDate) {
        const endDateTime = new Date(`${endDate}T${endTime}:00`).toISOString();
        fd.append("endDate", endDateTime);
      }

      // Variants
      fd.append("allowVariantPerItem", String(allowVariantPerItem));
      fd.append("hideThemeVariantPicker", String(hideThemeVariantPicker));
      fd.append("hideUnavailableVariants", String(hideUnavailableVariants));
      fd.append("dontUpdateOtherProducts", String(dontUpdateOtherProducts));

      // Pricing
      fd.append("showPricePerItem", String(showPricePerItem));
      fd.append("useCompareAtPrice", String(useCompareAtPrice));
      fd.append("showPricesWithoutDecimals", String(showPricesWithoutDecimals));
      fd.append("priceRounding", String(priceRounding));
      fd.append("updateThemeProductPrice", String(updateThemeProductPrice));

      // Cart & Alert
      fd.append("skipCart", String(skipCart));
      fd.append("lowStockAlert", String(lowStockAlert));

      submit(fd, { method: "POST" });

      shopify.toast.show(intentVal === "publish" ? "Deal published!" : "Draft saved!");

      setTimeout(() => {
        setIsSaving(false);
        setIsPublishing(false);
        navigate("/app");
      }, 1200);
    },
    [
      name,
      blockTitle,
      discountName,
      dealType,
      targetType,
      targetIds,
      tiers,
      style,
      countdownEnabled,
      countdownType,
      countdownText,
      countdownDuration,
      countdownColor,
      countdownBg,
      upsellsEnabled,
      upsellProduct,
      upsellPrice,
      upsellText,
      giftsEnabled,
      giftThreshold,
      giftProduct,
      giftText,
      stickyEnabled,
      stickyText,
      stickyBtnText,
      excludeB2B,
      applyDiscountOnlyViaWidget,
      markets,
      startDate,
      startTime,
      setEndDate,
      endDate,
      endTime,
      allowVariantPerItem,
      hideThemeVariantPicker,
      hideUnavailableVariants,
      dontUpdateOtherProducts,
      showPricePerItem,
      useCompareAtPrice,
      showPricesWithoutDecimals,
      priceRounding,
      updateThemeProductPrice,
      skipCart,
      lowStockAlert,
      shopify,
      navigate,
      submit,
    ]
  );

  // ─── Computed Price logic ──────────────────────────────────────────────────

  const baseMockPrice = 29.99;

  function computePrice(tier: TierLocal): { display: string; original: string } {
    const original = (baseMockPrice * tier.quantity).toFixed(2);
    if (tier.discountType === "percentage") {
      const disc = baseMockPrice * tier.quantity * (1 - tier.discountValue / 100);
      return { display: disc.toFixed(2), original };
    } else if (tier.discountType === "fixed") {
      const disc = baseMockPrice * tier.quantity - tier.discountValue;
      return { display: Math.max(disc, 0).toFixed(2), original };
    } else {
      return { display: tier.discountValue.toFixed(2), original };
    }
  }

  function savePct(tier: TierLocal): number {
    if (tier.discountType === "percentage") return tier.discountValue;
    const orig = baseMockPrice * tier.quantity;
    const { display } = computePrice(tier);
    return Math.round(((orig - parseFloat(display)) / orig) * 100);
  }

  // ─── Custom CSS styles ─────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    background: "#ffffff",
    border: "1px solid #e1e3e5",
    borderRadius: "8px",
    marginBottom: "12px",
    overflow: "hidden",
    boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.05)",
  };

  const headerRowStyle = (isOpen: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    padding: "16px",
    cursor: "pointer",
    background: "#ffffff",
    userSelect: "none",
  });

  const contentBlockStyle: React.CSSProperties = {
    padding: "16px",
    background: "#ffffff",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 600,
    color: "#4a4a4a",
    marginBottom: "6px",
    display: "block",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    fontSize: "14px",
    color: "#1a1a1a",
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f6f6f7", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      
      {/* ── CSS Toggle Switch Styling ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        .bundlify-switch {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
        }
        .bundlify-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .bundlify-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #cbd5e1;
          transition: .2s;
          border-radius: 20px;
        }
        .bundlify-slider:before {
          position: absolute;
          content: "";
          height: 14px;
          width: 14px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .2s;
          border-radius: 50%;
        }
        .bundlify-switch input:checked + .bundlify-slider {
          background-color: #000000;
        }
        .bundlify-switch input:checked + .bundlify-slider:before {
          transform: translateX(16px);
        }
      `}} />

      {/* Top Header Row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px", background: "#ffffff", borderBottom: "1px solid #e1e3e5", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button 
            onClick={() => navigate("/app")}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", display: "flex", alignItems: "center", gap: "6px", color: "#1a1a1a", fontWeight: 600 }}
          >
            ← Bundle deal
          </button>
        </div>
        <button 
          style={{ background: "#ffffff", border: "1px solid #babfc3", borderRadius: "6px", padding: "8px 16px", fontSize: "14px", fontWeight: 600, color: "#202223", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}
        >
          <img src={globeIcon} style={{ width: "14px", height: "14px", objectFit: "contain" }} alt="Translations" /> Translations
        </button>
      </div>

      {/* Work Area Split Screen */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        
        {/* Left Column Configurator */}
        <div style={{ flex: 1, padding: "24px", overflowY: "auto", borderRight: "1px solid #e1e3e5", maxWidth: "600px" }}>
          
          {/* ACCORDION: Products */}
          <div style={cardStyle}>
            <div style={headerRowStyle(openSection === "products")} onClick={() => setOpenSection(openSection === "products" ? "" : "products")}>
              <span style={{ marginRight: "12px", fontSize: "10px", color: "#6d7175", transition: "transform 0.2s", transform: openSection === "products" ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "#1a1a1a" }}>
                <img src={gridIcon} style={{ width: "16px", height: "16px", objectFit: "contain" }} alt="Products" /> Products
              </div>
            </div>
            {openSection === "products" && (
              <div style={contentBlockStyle}>
                {[
                  { value: "all", label: "All products" },
                  { value: "products", label: "Selected products" },
                  { value: "collections", label: "Selected collections" }
                ].map((opt) => (
                  <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: "8px", margin: "10px 0", fontSize: "14px", cursor: "pointer" }}>
                    <input 
                      type="radio" 
                      name="targetType" 
                      checked={targetType === opt.value} 
                      onChange={() => {
                        setTargetType(opt.value);
                        setTargetIds([]);
                        setSelectedResources([]);
                      }}
                      style={{ accentColor: "#000000" }}
                    />
                    {opt.label}
                  </label>
                ))}

                {targetType === "products" && (
                  <div style={{ marginTop: "12px", borderTop: "1px solid #f1f1f1", paddingTop: "12px" }}>
                    <button
                      type="button"
                      onClick={openProductPicker}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#1a1a1a",
                        cursor: "pointer",
                        width: "100%",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.2s"
                      }}
                    >
                      🔍 Browse Products
                    </button>
                    {selectedResources.length > 0 && (
                      <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                        {selectedResources.map((item) => (
                          <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              {item.image ? (
                                <img src={item.image} alt={item.title} style={{ width: "32px", height: "32px", borderRadius: "4px", objectFit: "cover", border: "1px solid #e2e8f0" }} />
                              ) : (
                                <div style={{ width: "32px", height: "32px", borderRadius: "4px", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>📦</div>
                              )}
                              <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "340px" }}>{item.title}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeResource(item.id)}
                              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "14px", padding: "2px 6px" }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {targetType === "collections" && (
                  <div style={{ marginTop: "12px", borderTop: "1px solid #f1f1f1", paddingTop: "12px" }}>
                    <button
                      type="button"
                      onClick={openCollectionPicker}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#1a1a1a",
                        cursor: "pointer",
                        width: "100%",
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.2s"
                      }}
                    >
                      📁 Browse Collections
                    </button>
                    {selectedResources.length > 0 && (
                      <div style={{ marginTop: "12px", display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto" }}>
                        {selectedResources.map((item) => (
                          <div key={item.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              {item.image ? (
                                <img src={item.image} alt={item.title} style={{ width: "32px", height: "32px", borderRadius: "4px", objectFit: "cover", border: "1px solid #e2e8f0" }} />
                              ) : (
                                <div style={{ width: "32px", height: "32px", borderRadius: "4px", background: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px" }}>📁</div>
                              )}
                              <span style={{ fontSize: "13px", fontWeight: 500, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "340px" }}>{item.title}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => removeResource(item.id)}
                              style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "14px", padding: "2px 6px" }}
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ACCORDION: Settings */}
          <div style={cardStyle}>
            <div style={headerRowStyle(openSection === "settings")} onClick={() => setOpenSection(openSection === "settings" ? "" : "settings")}>
              <span style={{ marginRight: "12px", fontSize: "10px", color: "#6d7175", transition: "transform 0.2s", transform: openSection === "settings" ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "#1a1a1a" }}>
                <img src={settingsIcon} style={{ width: "16px", height: "16px", objectFit: "contain" }} alt="Settings" /> Settings
              </div>
            </div>
            {openSection === "settings" && (
              <div style={contentBlockStyle}>
                
                {/* Internal Name */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle}>Name (only visible for you)</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
                </div>

                {/* Block Title */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={labelStyle}>Block title</label>
                  <input type="text" value={blockTitle} onChange={(e) => setBlockTitle(e.target.value)} style={inputStyle} />
                </div>

                {/* Discount Name */}
                <div style={{ marginBottom: "20px" }}>
                  <label style={labelStyle}>Discount name (shown in cart/checkout)</label>
                  <input type="text" value={discountName} onChange={(e) => setDiscountName(e.target.value)} style={inputStyle} />
                </div>

                {/* Visibility */}
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px", marginBottom: "20px" }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#1a1a1a", marginBottom: "12px" }}>Visibility</div>
                  <div style={{ marginBottom: "12px" }}>
                    <label style={labelStyle}>Markets</label>
                    <select value={markets} onChange={(e) => setMarkets(e.target.value)} style={inputStyle}>
                      <option value="all">All</option>
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", color: "#1a1a1a" }}>
                      <input type="checkbox" checked={excludeB2B} onChange={(e) => setExcludeB2B(e.target.checked)} style={{ accentColor: "#000" }} />
                      Exclude B2B customers <span style={{ color: "#8c9196", cursor: "help" }} title="Do not apply discounts for B2B orders">ⓘ</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", color: "#1a1a1a" }}>
                      <input type="checkbox" checked={applyDiscountOnlyViaWidget} onChange={(e) => setApplyDiscountOnlyViaWidget(e.target.checked)} style={{ accentColor: "#000" }} />
                      Apply discount only via bundle widget <span style={{ color: "#8c9196", cursor: "help" }} title="Discounts are only applied when items are added via the widget">ⓘ</span>
                    </label>
                  </div>
                </div>

                {/* Active Dates */}
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px", marginBottom: "20px" }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#1a1a1a", marginBottom: "12px" }}>Active dates</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                    <div>
                      <label style={labelStyle}>Start date</label>
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Start time (GMT+5:30)</label>
                      <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", color: "#1a1a1a" }}>
                    <input type="checkbox" checked={setEndDate} onChange={(e) => setSetEndDate(e.target.checked)} style={{ accentColor: "#000" }} />
                    Set end date
                  </label>
                  {setEndDate && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "12px" }}>
                      <div>
                        <label style={labelStyle}>End date</label>
                        <input type="date" value={endDate} onChange={(e) => setEndDateVal(e.target.value)} style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>End time (GMT+5:30)</label>
                        <input type="time" value={endTime} onChange={(e) => setEndTimeVal(e.target.value)} style={inputStyle} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Variants */}
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px", marginBottom: "20px" }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#1a1a1a", marginBottom: "12px" }}>Variants</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", color: "#1a1a1a" }}>
                      <input type="checkbox" checked={allowVariantPerItem} onChange={(e) => setAllowVariantPerItem(e.target.checked)} style={{ accentColor: "#000" }} />
                      Let customers choose different variants for each item <span style={{ color: "#8c9196", cursor: "help" }} title="Allow variant selections for each individual item in a bundle">ⓘ</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", color: "#1a1a1a" }}>
                      <input type="checkbox" checked={hideThemeVariantPicker} onChange={(e) => setHideThemeVariantPicker(e.target.checked)} style={{ accentColor: "#000" }} />
                      Hide theme variant picker
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", color: "#1a1a1a" }}>
                      <input type="checkbox" checked={hideUnavailableVariants} onChange={(e) => setHideUnavailableVariants(e.target.checked)} style={{ accentColor: "#000" }} />
                      Hide unavailable variant options
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", color: "#1a1a1a" }}>
                      <input type="checkbox" checked={dontUpdateOtherProducts} onChange={(e) => setDontUpdateOtherProducts(e.target.checked)} style={{ accentColor: "#000" }} />
                      Don't update other products when a variant is selected
                    </label>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <button
                      type="button"
                      style={{
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#1a1a1a",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px"
                      }}
                      onClick={() => shopify.toast.show("Add Swatches clicked")}
                    >
                      🎨 Add swatches
                    </button>
                    <button
                      type="button"
                      style={{
                        background: "#ffffff",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "#1a1a1a",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px"
                      }}
                      onClick={() => shopify.toast.show("Set Default Variants clicked")}
                    >
                      🎛️ Set default variants
                    </button>
                  </div>
                </div>

                {/* Pricing */}
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px", marginBottom: "20px" }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#1a1a1a", marginBottom: "12px" }}>Pricing</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", color: "#1a1a1a" }}>
                      <input type="checkbox" checked={showPricePerItem} onChange={(e) => setShowPricePerItem(e.target.checked)} style={{ accentColor: "#000" }} />
                      Show prices per item
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", color: "#1a1a1a" }}>
                      <input type="checkbox" checked={useCompareAtPrice} onChange={(e) => setUseCompareAtPrice(e.target.checked)} style={{ accentColor: "#000" }} />
                      Use product compare-at price <span style={{ color: "#8c9196", cursor: "help" }} title="Show comparison scratch-off pricing based on product compare-at prices">ⓘ</span>
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", color: "#1a1a1a" }}>
                      <input type="checkbox" checked={showPricesWithoutDecimals} onChange={(e) => setShowPricesWithoutDecimals(e.target.checked)} style={{ accentColor: "#000" }} />
                      Show prices without decimals
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", color: "#1a1a1a" }}>
                      <input type="checkbox" checked={priceRounding} onChange={(e) => setPriceRounding(e.target.checked)} style={{ accentColor: "#000" }} />
                      Price rounding
                    </label>
                    <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", color: "#1a1a1a" }}>
                      <input type="checkbox" checked={updateThemeProductPrice} onChange={(e) => setUpdateThemeProductPrice(e.target.checked)} style={{ accentColor: "#000" }} />
                      Update theme product price
                    </label>
                  </div>
                </div>

                {/* Cart */}
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px" }}>
                  <div style={{ fontWeight: 600, fontSize: "14px", color: "#1a1a1a", marginBottom: "12px" }}>Cart</div>
                  <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer", color: "#1a1a1a" }}>
                    <input type="checkbox" checked={skipCart} onChange={(e) => setSkipCart(e.target.checked)} style={{ accentColor: "#000" }} />
                    Skip cart and go to checkout directly
                  </label>
                </div>

              </div>
            )}
          </div>

          {/* ACCORDION: Style */}
          <div style={cardStyle}>
            <div style={headerRowStyle(openSection === "style")} onClick={() => setOpenSection(openSection === "style" ? "" : "style")}>
              <span style={{ marginRight: "12px", fontSize: "10px", color: "#6d7175", transition: "transform 0.2s", transform: openSection === "style" ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "#1a1a1a" }}>
                <img src={listIcon} style={{ width: "16px", height: "16px", objectFit: "contain" }} alt="Style" /> Style
              </div>
            </div>
            {openSection === "style" && (
              <div style={contentBlockStyle}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  <div>
                    <label style={labelStyle}>Layout</label>
                    <select value={style.layoutPreset} onChange={(e) => updateStyle({ layoutPreset: e.target.value })} style={inputStyle}>
                      <option value="card">Grid Cards</option>
                      <option value="list">Vertical List</option>
                      <option value="compact">Compact rows</option>
                      <option value="pill">Horizontal Pills</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Border Radius (px)</label>
                    <input type="number" value={style.cornerRadius} onChange={(e) => updateStyle({ cornerRadius: Number(e.target.value) })} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={labelStyle}>Border Color</label>
                    <input type="color" value={style.borderColor} onChange={(e) => updateStyle({ borderColor: e.target.value })} style={{ width: "100%", height: "36px", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer" }} />
                  </div>
                  <div>
                    <label style={labelStyle}>Selected Card Bg</label>
                    <input type="color" value={style.selectedBg} onChange={(e) => updateStyle({ selectedBg: e.target.value })} style={{ width: "100%", height: "36px", border: "1px solid #cbd5e1", borderRadius: "6px", cursor: "pointer" }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* DEAL BARS SECTION */}
          <div style={{ margin: "24px 0 12px 0", fontSize: "13px", fontWeight: 700, color: "#4a4a4a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Deal Bars
          </div>

          {tiers.map((tier, i) => (
            <div key={tier.id} style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", cursor: "pointer", background: "#ffffff" }} onClick={() => setExpandedTier(expandedTier === tier.id ? null : tier.id)}>
                
                {/* Drag Handle Mock - 6 Dots */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 3px)", gap: "3px", marginRight: "12px", cursor: "grab" }}>
                  <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#8c9196" }} />
                  <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#8c9196" }} />
                  <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#8c9196" }} />
                  <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#8c9196" }} />
                  <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#8c9196" }} />
                  <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: "#8c9196" }} />
                </div>

                <span style={{ marginRight: "8px", fontSize: "10px", color: "#6d7175", transition: "transform 0.2s", transform: expandedTier === tier.id ? "rotate(90deg)" : "rotate(0deg)" }}>▶</span>

                <div style={{ fontWeight: 600, color: "#1a1a1a", flex: 1, display: "flex", alignItems: "center", gap: "8px" }}>
                  <img src={megaphoneIcon} style={{ width: "16px", height: "16px", objectFit: "contain" }} alt="Bar" /> Bar #{i + 1} - {tier.label}
                </div>

                {/* Three Dots Actions Menu */}
                <div style={{ display: "flex", gap: "10px", alignItems: "center", position: "relative" }}>
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === tier.id ? null : tier.id); }} 
                    style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "#6d7175", padding: "0 8px", fontWeight: "bold" }}
                  >
                    •••
                  </button>
                  {openMenuId === tier.id && (
                    <>
                      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 998 }} onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); }} />
                      <div style={{ position: "absolute", right: 0, top: "24px", background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "6px", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)", zIndex: 999, minWidth: "120px", display: "flex", flexDirection: "column", padding: "4px 0" }}>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); moveTierUp(i); setOpenMenuId(null); }}
                          disabled={i === 0}
                          style={{ background: "none", border: "none", padding: "8px 12px", textAlign: "left", fontSize: "13px", cursor: i === 0 ? "not-allowed" : "pointer", color: i === 0 ? "#cbd5e1" : "#1a1a1a", width: "100%" }}
                        >
                          Move Up
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); moveTierDown(i); setOpenMenuId(null); }}
                          disabled={i === tiers.length - 1}
                          style={{ background: "none", border: "none", padding: "8px 12px", textAlign: "left", fontSize: "13px", cursor: i === tiers.length - 1 ? "not-allowed" : "pointer", color: i === tiers.length - 1 ? "#cbd5e1" : "#1a1a1a", width: "100%" }}
                        >
                          Move Down
                        </button>
                        <div style={{ height: "1px", background: "#cbd5e1", margin: "4px 0" }} />
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeTier(tier.id); setOpenMenuId(null); }}
                          style={{ background: "none", border: "none", padding: "8px 12px", textAlign: "left", fontSize: "13px", cursor: "pointer", color: "#ef4444", width: "100%" }}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {expandedTier === tier.id && (
                <div style={{ padding: "16px", borderTop: "1px solid #e1e3e5" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                    <div>
                      <label style={labelStyle}>Bar Label</label>
                      <input type="text" value={tier.label} onChange={(e) => updateTier(tier.id, { label: e.target.value })} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Quantity Required</label>
                      <input type="number" min={1} value={tier.quantity} onChange={(e) => updateTier(tier.id, { quantity: Number(e.target.value) })} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                    <div>
                      <label style={labelStyle}>Discount Type</label>
                      <select value={tier.discountType} onChange={(e) => updateTier(tier.id, { discountType: e.target.value as TierLocal["discountType"] })} style={inputStyle}>
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Discount ($)</option>
                        <option value="price">Set Price ($)</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Value</label>
                      <input type="number" min={0} value={tier.discountValue} onChange={(e) => updateTier(tier.id, { discountValue: Number(e.target.value) })} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", cursor: "pointer" }}>
                      <input type="checkbox" checked={tier.isBadgeEnabled} onChange={(e) => updateTier(tier.id, { isBadgeEnabled: e.target.checked })} style={{ accentColor: "#000" }} />
                      Show Active Highlight Badge
                    </label>
                    {tier.isBadgeEnabled && (
                      <input type="text" value={tier.badge} onChange={(e) => updateTier(tier.id, { badge: e.target.value })} placeholder="Most Popular" style={{ ...inputStyle, flex: 1 }} />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add Bar Button Container */}
          <div style={{
            width: "100%",
            padding: "16px 0",
            border: "1px dashed #cbd5e1",
            borderRadius: "8px",
            background: "#ffffff",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            marginBottom: "32px",
            boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
          }}>
            <button
              type="button"
              onClick={addTier}
              style={{
                background: "#1a1a1a",
                color: "#ffffff",
                border: "none",
                borderRadius: "20px",
                padding: "8px 16px",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
              }}
            >
              <img src={plusIcon} style={{ width: "12px", height: "12px", objectFit: "contain", filter: "invert(1)" }} alt="Add" /> Add bar
            </button>
          </div>

          {/* ADVANCED OPTIONAL ACCORDIONS WITH TOGGLES */}
          <div style={{ borderTop: "1px solid #e1e3e5", paddingTop: "20px" }}>
            
            {/* Toggle: Volume discount with other products */}
            <div style={cardStyle}>
              <div style={headerRowStyle(openSection === "volume")}>
                <span 
                  onClick={() => setOpenSection(openSection === "volume" ? "" : "volume")}
                  style={{ marginRight: "12px", fontSize: "10px", color: "#6d7175", cursor: "pointer", transition: "transform 0.2s", transform: openSection === "volume" ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  ▶
                </span>
                <div 
                  onClick={() => setOpenSection(openSection === "volume" ? "" : "volume")}
                  style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, flex: 1, cursor: "pointer", color: "#1a1a1a" }}
                >
                  <img src={questionIcon} style={{ width: "16px", height: "16px", objectFit: "contain" }} alt="Volume" /> Volume discount with other products
                </div>
                <label className="bundlify-switch">
                  <input type="checkbox" checked={volumeDiscountEnabled} onChange={(e) => setVolumeDiscountEnabled(e.target.checked)} />
                  <span className="bundlify-slider"></span>
                </label>
              </div>
              {openSection === "volume" && volumeDiscountEnabled && (
                <div style={contentBlockStyle}>
                  <p style={{ margin: 0, fontSize: "13px", color: "#6d7175" }}>
                    Enable this to allow volume discounting options using bundle variations across multiple catalog items.
                  </p>
                </div>
              )}
            </div>

            {/* Toggle: Countdown timer */}
            <div style={cardStyle}>
              <div style={headerRowStyle(openSection === "countdown")}>
                <span 
                  onClick={() => setOpenSection(openSection === "countdown" ? "" : "countdown")}
                  style={{ marginRight: "12px", fontSize: "10px", color: "#6d7175", cursor: "pointer", transition: "transform 0.2s", transform: openSection === "countdown" ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  ▶
                </span>
                <div 
                  onClick={() => setOpenSection(openSection === "countdown" ? "" : "countdown")}
                  style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, flex: 1, cursor: "pointer", color: "#1a1a1a" }}
                >
                  <img src={starIcon} style={{ width: "16px", height: "16px", objectFit: "contain" }} alt="Timer" /> Countdown timer
                </div>
                <label className="bundlify-switch">
                  <input type="checkbox" checked={countdownEnabled} onChange={(e) => setCountdownEnabled(e.target.checked)} />
                  <span className="bundlify-slider"></span>
                </label>
              </div>
              {openSection === "countdown" && countdownEnabled && (
                <div style={contentBlockStyle}>
                  <div style={{ marginBottom: "12px" }}>
                    <label style={labelStyle}>Timer Message</label>
                    <input type="text" value={countdownText} onChange={(e) => setCountdownText(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={labelStyle}>Type</label>
                      <select value={countdownType} onChange={(e) => setCountdownType(e.target.value)} style={inputStyle}>
                        <option value="fixed">Fixed Time</option>
                        <option value="midnight">Reset at Midnight</option>
                      </select>
                    </div>
                    {countdownType === "fixed" && (
                      <div>
                        <label style={labelStyle}>Minutes</label>
                        <input type="number" min={1} value={countdownDuration} onChange={(e) => setCountdownDuration(Number(e.target.value))} style={inputStyle} />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Toggle: Scratch-off */}
            <div style={cardStyle}>
              <div style={headerRowStyle(openSection === "scratchoff")}>
                <span 
                  onClick={() => setOpenSection(openSection === "scratchoff" ? "" : "scratchoff")}
                  style={{ marginRight: "12px", fontSize: "10px", color: "#6d7175", cursor: "pointer", transition: "transform 0.2s", transform: openSection === "scratchoff" ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  ▶
                </span>
                <div 
                  onClick={() => setOpenSection(openSection === "scratchoff" ? "" : "scratchoff")}
                  style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, flex: 1, cursor: "pointer", color: "#1a1a1a" }}
                >
                  <img src={lockIcon} style={{ width: "16px", height: "16px", objectFit: "contain" }} alt="Scratchoff" /> Scratch-off
                </div>
                <label className="bundlify-switch">
                  <input type="checkbox" checked={scratchOffEnabled} onChange={(e) => setScratchOffEnabled(e.target.checked)} />
                  <span className="bundlify-slider"></span>
                </label>
              </div>
              {openSection === "scratchoff" && scratchOffEnabled && (
                <div style={contentBlockStyle}>
                  <p style={{ margin: 0, fontSize: "13px", color: "#6d7175" }}>
                    Tying mystery savings or hidden percentages until clicked inside checkout.
                  </p>
                </div>
              )}
            </div>

            {/* Toggle: Subscriptions */}
            <div style={cardStyle}>
              <div style={headerRowStyle(openSection === "subscriptions")}>
                <span 
                  onClick={() => setOpenSection(openSection === "subscriptions" ? "" : "subscriptions")}
                  style={{ marginRight: "12px", fontSize: "10px", color: "#6d7175", cursor: "pointer", transition: "transform 0.2s", transform: openSection === "subscriptions" ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  ▶
                </span>
                <div 
                  onClick={() => setOpenSection(openSection === "subscriptions" ? "" : "subscriptions")}
                  style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, flex: 1, cursor: "pointer", color: "#1a1a1a" }}
                >
                  <img src={powerIcon} style={{ width: "16px", height: "16px", objectFit: "contain" }} alt="Subscriptions" /> Subscriptions
                </div>
                <label className="bundlify-switch">
                  <input type="checkbox" checked={subscriptionsEnabled} onChange={(e) => setSubscriptionsEnabled(e.target.checked)} />
                  <span className="bundlify-slider"></span>
                </label>
              </div>
              {openSection === "subscriptions" && subscriptionsEnabled && (
                <div style={contentBlockStyle}>
                  <p style={{ margin: 0, fontSize: "13px", color: "#6d7175" }}>
                    Enable Recurring Subscribe & Save options on storefront items.
                  </p>
                </div>
              )}
            </div>

            {/* Toggle: Checkbox upsells */}
            <div style={cardStyle}>
              <div style={headerRowStyle(openSection === "upsells")}>
                <span 
                  onClick={() => setOpenSection(openSection === "upsells" ? "" : "upsells")}
                  style={{ marginRight: "12px", fontSize: "10px", color: "#6d7175", cursor: "pointer", transition: "transform 0.2s", transform: openSection === "upsells" ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  ▶
                </span>
                <div 
                  onClick={() => setOpenSection(openSection === "upsells" ? "" : "upsells")}
                  style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, flex: 1, cursor: "pointer", color: "#1a1a1a" }}
                >
                  <img src={checkIcon} style={{ width: "16px", height: "16px", objectFit: "contain" }} alt="Upsells" /> Checkbox upsells
                </div>
                <label className="bundlify-switch">
                  <input type="checkbox" checked={upsellsEnabled} onChange={(e) => setUpsellsEnabled(e.target.checked)} />
                  <span className="bundlify-slider"></span>
                </label>
              </div>
              {openSection === "upsells" && upsellsEnabled && (
                <div style={contentBlockStyle}>
                  <div style={{ marginBottom: "12px" }}>
                    <label style={labelStyle}>Product Target Name</label>
                    <input type="text" value={upsellProduct} onChange={(e) => setUpsellProduct(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={labelStyle}>Upsell Price ($)</label>
                      <input type="number" step="0.01" value={upsellPrice} onChange={(e) => setUpsellPrice(Number(e.target.value))} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Upsell Text</label>
                      <input type="text" value={upsellText} onChange={(e) => setUpsellText(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Toggle: Progressive gifts */}
            <div style={cardStyle}>
              <div style={headerRowStyle(openSection === "gifts")}>
                <span 
                  onClick={() => setOpenSection(openSection === "gifts" ? "" : "gifts")}
                  style={{ marginRight: "12px", fontSize: "10px", color: "#6d7175", cursor: "pointer", transition: "transform 0.2s", transform: openSection === "gifts" ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  ▶
                </span>
                <div 
                  onClick={() => setOpenSection(openSection === "gifts" ? "" : "gifts")}
                  style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, flex: 1, cursor: "pointer", color: "#1a1a1a" }}
                >
                  <img src={starIcon} style={{ width: "16px", height: "16px", objectFit: "contain" }} alt="Gifts" /> Progressive gifts
                </div>
                <label className="bundlify-switch">
                  <input type="checkbox" checked={giftsEnabled} onChange={(e) => setGiftsEnabled(e.target.checked)} />
                  <span className="bundlify-slider"></span>
                </label>
              </div>
              {openSection === "gifts" && giftsEnabled && (
                <div style={contentBlockStyle}>
                  <div style={{ marginBottom: "12px" }}>
                    <label style={labelStyle}>Free Gift Product</label>
                    <input type="text" value={giftProduct} onChange={(e) => setGiftProduct(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={labelStyle}>Unlock Limit ($)</label>
                      <input type="number" value={giftThreshold} onChange={(e) => setGiftThreshold(Number(e.target.value))} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Milestone Message</label>
                      <input type="text" value={giftText} onChange={(e) => setGiftText(e.target.value)} style={inputStyle} />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Toggle: Sticky add to cart */}
            <div style={cardStyle}>
              <div style={headerRowStyle(openSection === "sticky")}>
                <span 
                  onClick={() => setOpenSection(openSection === "sticky" ? "" : "sticky")}
                  style={{ marginRight: "12px", fontSize: "10px", color: "#6d7175", cursor: "pointer", transition: "transform 0.2s", transform: openSection === "sticky" ? "rotate(90deg)" : "rotate(0deg)" }}
                >
                  ▶
                </span>
                <div 
                  onClick={() => setOpenSection(openSection === "sticky" ? "" : "sticky")}
                  style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, flex: 1, cursor: "pointer", color: "#1a1a1a" }}
                >
                  <img src={eyeIcon} style={{ width: "16px", height: "16px", objectFit: "contain" }} alt="Sticky" /> Sticky add to cart
                </div>
                <label className="bundlify-switch">
                  <input type="checkbox" checked={stickyEnabled} onChange={(e) => setStickyEnabled(e.target.checked)} />
                  <span className="bundlify-slider"></span>
                </label>
              </div>
              {openSection === "sticky" && stickyEnabled && (
                <div style={contentBlockStyle}>
                  <div style={{ marginBottom: "12px" }}>
                    <label style={labelStyle}>Sticky Message</label>
                    <input type="text" value={stickyText} onChange={(e) => setStickyText(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Button Title</label>
                    <input type="text" value={stickyBtnText} onChange={(e) => setStickyBtnText(e.target.value)} style={inputStyle} />
                  </div>
                </div>
              )}
            </div>

            {/* Toggle: Low stock alert */}
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 600, color: "#1a1a1a" }}>
                  <img src={lockIcon} style={{ width: "16px", height: "16px", objectFit: "contain" }} alt="LowStock" /> Low stock alert
                </div>
                <label className="bundlify-switch">
                  <input type="checkbox" checked={lowStockAlert} onChange={(e) => setLowStockAlert(e.target.checked)} />
                  <span className="bundlify-slider"></span>
                </label>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column Preview Panel */}
        <div style={{ flex: 1, padding: "24px", display: "flex", flexDirection: "column", background: "#f6f6f7", position: "relative" }}>
          
          {/* Header toolbar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 600, color: "#1a1a1a", display: "flex", alignItems: "center", gap: "4px" }}>
              Preview <span style={{ fontSize: "14px", color: "#6d7175" }}>↗</span>
            </h3>
            <button style={{ background: "#ffffff", border: "1px solid #babfc3", borderRadius: "6px", padding: "6px 12px", fontSize: "13px", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
              🧪 Setup A/B test
            </button>
          </div>

          {/* The grey card mockup container */}
          <div style={{ border: "1px solid #e1e3e5", borderRadius: "12px", background: "#ffffff", padding: "16px", flex: 1, display: "flex", flexDirection: "column" }}>
            
            {/* Context Toolbars */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", padding: "12px", background: "#f1f2f4", borderRadius: "8px", marginBottom: "20px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#6d7175", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Product previewing</span>
                <select value={previewProduct} onChange={(e) => setPreviewProduct(e.target.value)} style={{ ...inputStyle, padding: "6px 10px", background: "#ffffff" }}>
                  <option value="Classic Ceramic Mug">Classic Ceramic Mug</option>
                  <option value="Classic Baseball Cap">Classic Baseball Cap</option>
                </select>
              </div>
              <div>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "#6d7175", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>Country previewing</span>
                <select value={previewCountry} onChange={(e) => setPreviewCountry(e.target.value)} style={{ ...inputStyle, padding: "6px 10px", background: "#ffffff" }}>
                  <option value="United States">United States</option>
                  <option value="Canada">Canada</option>
                  <option value="India">India</option>
                </select>
              </div>
            </div>

            {/* Progressive Gifts Milestones */}
            {giftsEnabled && (() => {
              const currentTotal = parseFloat(computePrice(tiers[previewSelected] || tiers[0]).display);
              const progressPct = Math.min((currentTotal / giftThreshold) * 100, 100);
              const remaining = Math.max(giftThreshold - currentTotal, 0).toFixed(2);
              const message = remaining === "0.00" 
                ? `🎉 Congratulations! You unlocked a ${giftProduct}!`
                : giftText.replace("{{remaining}}", remaining).replace("{{gift}}", giftProduct);

              return (
                <div style={{ padding: "10px 14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px", marginBottom: "14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: 600, color: "#1e293b", marginBottom: "4px" }}>
                    <span>Progress: ${currentTotal.toFixed(2)} / ${giftThreshold.toFixed(2)}</span>
                    <span style={{ color: remaining === "0.00" ? "#16a34a" : "#64748b" }}>{remaining === "0.00" ? "Unlocked!" : "Locked"}</span>
                  </div>
                  <div style={{ width: "100%", height: "6px", background: "#cbd5e1", borderRadius: "100px", overflow: "hidden", marginBottom: "4px" }}>
                    <div style={{ width: `${progressPct}%`, height: "100%", background: remaining === "0.00" ? "#22c55e" : "#000000", transition: "width 0.2s ease" }} />
                  </div>
                  <div style={{ fontSize: "11px", color: remaining === "0.00" ? "#15803d" : "#475569", fontWeight: 500 }}>
                    {message}
                  </div>
                </div>
              );
            })()}

            {/* Countdown Banner */}
            {countdownEnabled && (
              <div style={{ background: countdownBg, color: countdownColor, padding: "8px 12px", borderRadius: "6px", fontSize: "13px", fontWeight: 600, textAlign: "center", marginBottom: "14px", border: `1px solid ${countdownColor}44`, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                <span>⏱️</span>
                <span>{countdownText.replace("{{timer}}", countdownType === "fixed" ? `${countdownDuration}:00` : "23:59:59")}</span>
              </div>
            )}

            {/* Widget layout container wrapper */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
              <div style={{ width: "100%", maxWidth: "480px" }}>
                
                {/* Block Title Header */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
                  <div style={{ flex: 1, height: "1px", background: "#e1e3e5" }} />
                  <span style={{ fontSize: `${style.blockTitleSize}px`, fontWeight: style.blockTitleStyle === "bold" ? 700 : 400, color: style.blockTitleColor, letterSpacing: "1px", textTransform: "uppercase" }}>
                    {blockTitle}
                  </span>
                  <div style={{ flex: 1, height: "1px", background: "#e1e3e5" }} />
                </div>

                {/* Tiers List */}
                <div style={{ display: "flex", flexDirection: style.layoutPreset === "pill" ? "row" : "column", gap: `${style.spacing}px` }}>
                  {tiers.map((tier, idx) => {
                    const isSelected = previewSelected === idx;
                    const { display, original } = computePrice(tier);
                    const save = savePct(tier);
                    return (
                      <div
                        key={tier.id}
                        onClick={() => setPreviewSelected(idx)}
                        style={{
                          border: isSelected ? "2px solid #000000" : "1.5px solid #e1e3e5",
                          borderRadius: `${style.cornerRadius}px`,
                          background: "#ffffff",
                          padding: "14px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          position: "relative"
                        }}
                      >
                        
                        {/* Radio box */}
                        <div style={{ width: "18px", height: "18px", borderRadius: "50%", border: "2px solid #000000", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {isSelected && (
                            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#000000" }} />
                          )}
                        </div>

                        {/* Title & Badge */}
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: style.titleStyle === "bold" ? 700 : 500, fontSize: `${style.titleSize}px`, color: style.titleColor }}>
                            {tier.label}
                          </span>
                          {save > 0 && (
                            <span style={{ marginLeft: "8px", fontSize: "11px", fontWeight: 700, background: "#e3e3e3", color: "#1a1a1a", padding: "2px 8px", borderRadius: "100px" }}>
                              SAVE {save}%
                            </span>
                          )}
                        </div>

                        {/* Prices */}
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 700, fontSize: "15px", color: style.priceColor }}>
                            ${display}
                          </div>
                          {save > 0 && (
                            <div style={{ fontSize: "12px", color: style.fullPriceColor, textDecoration: "line-through" }}>
                              ${original}
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>

                {/* Upsell Checkbox */}
                {upsellsEnabled && (
                  <div style={{ marginTop: "14px", padding: "10px 12px", border: "1px solid #e1e3e5", borderRadius: `${style.cornerRadius}px`, background: "#ffffff", display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }}>
                    <input type="checkbox" defaultChecked style={{ accentColor: "#000", width: "16px", height: "16px" }} />
                    <div style={{ fontSize: "13px", color: "#1a1a1a", fontWeight: 500 }}>
                      {upsellText.replace("{{product}}", upsellProduct).replace("{{price}}", upsellPrice.toFixed(2))}
                    </div>
                  </div>
                )}

                {/* Grey Promo Bar: FREE special gift! */}
                {giftsEnabled && (
                  <div style={{ marginTop: "14px", background: "#cccccc", border: "1.5px solid #bbbbbb", borderRadius: `${style.cornerRadius}px`, padding: "12px", textAlign: "center", fontSize: "13.5px", fontWeight: 700, color: "#1a1a1a" }}>
                    + FREE special gift!
                  </div>
                )}

              </div>
            </div>

          </div>

          {/* Sticky Cart bar preview overlay */}
          {stickyEnabled && (
            <div style={{ background: "#ffffff", border: "2px solid #000000", borderRadius: "8px", padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", boxShadow: "0 2px 8px rgba(0,0,0,0.1)", marginTop: "16px" }}>
              <div style={{ fontSize: "13.5px", fontWeight: 600, color: "#1a1a1a" }}>{stickyText}</div>
              <button style={{ background: "#000000", color: "#ffffff", border: "none", borderRadius: "6px", padding: "8px 14px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                {stickyBtnText} — ${computePrice(tiers[previewSelected] || tiers[0]).display}
              </button>
            </div>
          )}

          {/* Save / Publish Footer row */}
          <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end", marginTop: "24px", borderTop: "1px solid #e1e3e5", paddingTop: "16px" }}>
            <button 
              onClick={() => handleSave("save")} 
              disabled={isSaving || isPublishing}
              style={{ background: "#ffffff", border: "1px solid #babfc3", borderRadius: "6px", padding: "8px 16px", fontSize: "14px", fontWeight: 600, color: "#202223", cursor: "pointer", opacity: isSaving ? 0.7 : 1 }}
            >
              {isSaving ? "Saving..." : "Save as draft"}
            </button>
            <button 
              onClick={() => handleSave("publish")} 
              disabled={isSaving || isPublishing}
              style={{ background: "#000000", color: "#ffffff", border: "none", borderRadius: "6px", padding: "8px 18px", fontSize: "14px", fontWeight: 700, cursor: "pointer", opacity: isPublishing ? 0.7 : 1 }}
            >
              {isPublishing ? "Publishing..." : "Publish"}
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
