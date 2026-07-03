import { useState, useCallback } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useFetcher, useSubmit } from "react-router";
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

// ─── Types ───────────────────────────────────────────────────────────────────

type TierLocal = {
  id: string; // local uuid (not DB id)
  label: string;
  quantity: number;
  discountType: "percentage" | "fixed" | "price";
  discountValue: number;
  badge: string;
  isBadgeEnabled: boolean;
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
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const dealId = params.id;

  let deal = null;
  if (dealId && dealId !== "new") {
    deal = await getDealById(dealId, shop);
  }

  return { shop, deal, isNew: !dealId || dealId === "new" };
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
      targetIds: [],
      excludeIds: [],
      status,
    };

    const tiersForDB = tiers.map((t: TierLocal, i: number) => ({
      label: t.label,
      quantity: t.quantity,
      discountType: t.discountType,
      discountValue: t.discountValue,
      badge: t.badge,
      isBadgeEnabled: t.isBadgeEnabled,
      position: i,
    }));

    let savedDeal;
    if (isNew) {
      savedDeal = await createDeal(dealInput, tiersForDB, style);
    } else {
      savedDeal = await updateDeal(dealId!, shop, dealInput, tiersForDB, style);
    }

    // If publishing, create/update Shopify Automatic Discount
    if (intent === "publish" && savedDeal.tiers.length > 0) {
      try {
        // Create an automatic percentage discount using the first tier as baseline
        // In a full implementation, Shopify Functions would handle complex tier logic
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
        // Still save the deal as active even if discount creation fails
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
  selectedBg: "#f0f5ff",
  borderColor: "#000000",
  blockTitleColor: "#000000",
  titleColor: "#000000",
  subtitleColor: "#6d7175",
  priceColor: "#000000",
  fullPriceColor: "#8c9196",
  labelBg: "#e3e3e3",
  labelText: "#000000",
  badgeBg: "#000000",
  badgeText: "#ffffff",
  blockTitleSize: 14,
  blockTitleStyle: "bold",
  titleSize: 15,
  titleStyle: "bold",
  subtitleSize: 14,
  subtitleStyle: "regular",
  labelSize: 12,
  labelStyle: "regular",
};

const DEFAULT_TIERS: TierLocal[] = [
  {
    id: uid(),
    label: "Single",
    quantity: 1,
    discountType: "percentage",
    discountValue: 0,
    badge: "",
    isBadgeEnabled: false,
  },
  {
    id: uid(),
    label: "Duo",
    quantity: 2,
    discountType: "percentage",
    discountValue: 10,
    badge: "Most Popular",
    isBadgeEnabled: true,
  },
  {
    id: uid(),
    label: "Best Value",
    quantity: 3,
    discountType: "percentage",
    discountValue: 20,
    badge: "Best Value",
    isBadgeEnabled: true,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function BundleConfigurator() {
  const { deal, isNew } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  const submit = useSubmit();

  // ── Main deal state ──
  const [name, setName] = useState(deal?.name || "My Bundle Deal");
  const [blockTitle, setBlockTitle] = useState(deal?.blockTitle || "BUNDLE & SAVE");
  const [discountName, setDiscountName] = useState(deal?.discountName || "");
  const [dealType, setDealType] = useState(deal?.dealType || "quantity_breaks");
  const [targetType, setTargetType] = useState(deal?.targetType || "all");

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
        }))
      : DEFAULT_TIERS
  );
  const [expandedTier, setExpandedTier] = useState<string | null>(null);

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

  // ── Accordion state ──
  const [openSection, setOpenSection] = useState<string>("products");

  // ── Selected preview tier ──
  const [previewSelected, setPreviewSelected] = useState(0);

  // ── Saving state ──
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // ─── Tier helpers ──────────────────────────────────────────────────────────

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

  // ─── Style helpers ─────────────────────────────────────────────────────────

  const updateStyle = (patch: Partial<StyleLocal>) => {
    setStyle((s) => ({ ...s, ...patch }));
  };

  // ─── Submit helpers ────────────────────────────────────────────────────────

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
      fd.append("tiers", JSON.stringify(tiers));
      fd.append("style", JSON.stringify(style));

      submit(fd, { method: "POST" });

      shopify.toast.show(
        intentVal === "publish"
          ? "Deal published! Widget will appear on product pages."
          : "Draft saved!"
      );

      setTimeout(() => {
        setIsSaving(false);
        setIsPublishing(false);
        navigate("/app");
      }, 1500);
    },
    [name, blockTitle, discountName, dealType, targetType, tiers, style, shopify, navigate, submit]
  );

  // ─── Computed preview values ───────────────────────────────────────────────

  const selectedTier = tiers[previewSelected] || tiers[0];
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

  // ─── Render ────────────────────────────────────────────────────────────────

  const sectionStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e4e4e7",
    borderRadius: "10px",
    marginBottom: "8px",
    overflow: "hidden",
  };

  const sectionHeaderStyle = (isOpen: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    padding: "14px 16px",
    cursor: "pointer",
    background: isOpen ? "#fafafa" : "#fff",
    borderBottom: isOpen ? "1px solid #e4e4e7" : "none",
    gap: "10px",
    userSelect: "none",
  });

  const sectionBodyStyle: React.CSSProperties = {
    padding: "16px",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "12px",
    fontWeight: 600,
    color: "#52525b",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    marginBottom: "6px",
    display: "block",
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid #d4d4d8",
    borderRadius: "6px",
    fontSize: "14px",
    color: "#18181b",
    outline: "none",
    boxSizing: "border-box",
  };

  const radioRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 0",
    cursor: "pointer",
    fontSize: "14px",
    color: "#18181b",
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f4f4f5", flexDirection: "column" }}>
      {/* Top Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "12px 20px",
          background: "#fff",
          borderBottom: "1px solid #e4e4e7",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <button
            onClick={() => navigate("/app")}
            style={{
              background: "none",
              border: "1px solid #e4e4e7",
              borderRadius: "8px",
              padding: "6px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              color: "#52525b",
            }}
          >
            ← Back
          </button>
          <div>
            <h1 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#09090b" }}>
              {isNew ? "Create Bundle Deal" : "Edit Bundle Deal"}
            </h1>
            <p style={{ margin: 0, fontSize: "12px", color: "#71717a" }}>
              Configure and publish your bundle widget
            </p>
          </div>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            onClick={() => handleSave("save")}
            disabled={isSaving || isPublishing}
            style={{
              background: "#fff",
              border: "1px solid #d4d4d8",
              borderRadius: "8px",
              padding: "8px 16px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              color: "#18181b",
              opacity: isSaving ? 0.7 : 1,
            }}
          >
            {isSaving ? "Saving..." : "Save as draft"}
          </button>
          <button
            onClick={() => handleSave("publish")}
            disabled={isSaving || isPublishing}
            style={{
              background: "#09090b",
              border: "none",
              borderRadius: "8px",
              padding: "8px 18px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              color: "#fff",
              opacity: isPublishing ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {isPublishing ? "Publishing..." : "🚀 Publish"}
          </button>
        </div>
      </div>

      {/* Body: Sidebar + Preview */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* ── Left Sidebar ── */}
        <div
          style={{
            width: "340px",
            minWidth: "340px",
            borderRight: "1px solid #e4e4e7",
            background: "#f9f9f9",
            overflowY: "auto",
            padding: "14px",
          }}
        >
          {/* SECTION: Products */}
          <div style={sectionStyle}>
            <div
              style={sectionHeaderStyle(openSection === "products")}
              onClick={() => setOpenSection(openSection === "products" ? "" : "products")}
            >
              <span style={{ fontSize: "16px" }}>🏷️</span>
              <span style={{ fontWeight: 600, fontSize: "14px", flex: 1 }}>Products</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
                style={{ transform: openSection === "products" ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {openSection === "products" && (
              <div style={sectionBodyStyle}>
                {[
                  { value: "all", label: "All products" },
                  { value: "products", label: "Selected products" },
                  { value: "collections", label: "Selected collections" },
                ].map((opt) => (
                  <label key={opt.value} style={radioRowStyle}>
                    <input
                      type="radio"
                      name="targetType"
                      value={opt.value}
                      checked={targetType === opt.value}
                      onChange={() => setTargetType(opt.value)}
                      style={{ accentColor: "#09090b", width: "16px", height: "16px" }}
                    />
                    {opt.label}
                  </label>
                ))}
                {targetType !== "all" && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "10px",
                      border: "1px dashed #d4d4d8",
                      borderRadius: "6px",
                      fontSize: "13px",
                      color: "#71717a",
                      textAlign: "center",
                      cursor: "pointer",
                      background: "#fafafa",
                    }}
                  >
                    + Select {targetType === "products" ? "products" : "collections"}
                  </div>
                )}
                <div
                  style={{
                    marginTop: "10px",
                    padding: "8px 10px",
                    border: "1px dashed #d4d4d8",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "#71717a",
                    cursor: "pointer",
                    background: "#fafafa",
                  }}
                >
                  + Select exceptions
                </div>
              </div>
            )}
          </div>

          {/* SECTION: Settings */}
          <div style={sectionStyle}>
            <div
              style={sectionHeaderStyle(openSection === "settings")}
              onClick={() => setOpenSection(openSection === "settings" ? "" : "settings")}
            >
              <span style={{ fontSize: "16px" }}>⚙️</span>
              <span style={{ fontWeight: 600, fontSize: "14px", flex: 1 }}>Settings</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
                style={{ transform: openSection === "settings" ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {openSection === "settings" && (
              <div style={sectionBodyStyle}>
                <div style={{ marginBottom: "14px" }}>
                  <label style={labelStyle}>Internal Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Summer Bundle Deal"
                    style={inputStyle}
                  />
                  <p style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "4px" }}>
                    Only visible to you in the dashboard
                  </p>
                </div>
                <div style={{ marginBottom: "14px" }}>
                  <label style={labelStyle}>Block Title</label>
                  <input
                    type="text"
                    value={blockTitle}
                    onChange={(e) => setBlockTitle(e.target.value)}
                    placeholder="BUNDLE & SAVE"
                    style={inputStyle}
                  />
                  <p style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "4px" }}>
                    Shown above the widget on the product page
                  </p>
                </div>
                <div style={{ marginBottom: "14px" }}>
                  <label style={labelStyle}>Discount Name (in cart)</label>
                  <input
                    type="text"
                    value={discountName}
                    onChange={(e) => setDiscountName(e.target.value)}
                    placeholder="Bundle Discount"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Deal Type</label>
                  <select
                    value={dealType}
                    onChange={(e) => setDealType(e.target.value)}
                    style={{ ...inputStyle, cursor: "pointer" }}
                  >
                    <option value="quantity_breaks">Quantity Breaks</option>
                    <option value="bxgy">Buy X Get Y (BXGY)</option>
                    <option value="complete_bundle">Complete Bundle</option>
                    <option value="volume_discount">Volume Discount</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* SECTION: Style */}
          <div style={sectionStyle}>
            <div
              style={sectionHeaderStyle(openSection === "style")}
              onClick={() => setOpenSection(openSection === "style" ? "" : "style")}
            >
              <span style={{ fontSize: "16px" }}>🎨</span>
              <span style={{ fontWeight: 600, fontSize: "14px", flex: 1 }}>Style</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth="2.5"
                style={{ transform: openSection === "style" ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
            {openSection === "style" && (
              <div style={sectionBodyStyle}>
                {/* Layout Preset */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={labelStyle}>Layout</label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {["card", "list", "compact", "pill"].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => updateStyle({ layoutPreset: preset })}
                        style={{
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: style.layoutPreset === preset ? "2px solid #09090b" : "1px solid #d4d4d8",
                          background: style.layoutPreset === preset ? "#09090b" : "#fff",
                          color: style.layoutPreset === preset ? "#fff" : "#18181b",
                          fontSize: "12px",
                          fontWeight: 600,
                          cursor: "pointer",
                          textTransform: "capitalize",
                        }}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Corner Radius */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={labelStyle}>Corner Radius: {style.cornerRadius}px</label>
                  <input
                    type="range"
                    min={0}
                    max={24}
                    value={style.cornerRadius}
                    onChange={(e) => updateStyle({ cornerRadius: Number(e.target.value) })}
                    style={{ width: "100%", accentColor: "#09090b" }}
                  />
                </div>

                {/* Colors */}
                <div style={{ marginBottom: "14px" }}>
                  <label style={labelStyle}>Colors</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    {(
                      [
                        ["Card Background", "cardsBg"],
                        ["Selected Bg", "selectedBg"],
                        ["Border", "borderColor"],
                        ["Block Title", "blockTitleColor"],
                        ["Title", "titleColor"],
                        ["Subtitle", "subtitleColor"],
                        ["Price", "priceColor"],
                        ["Badge Bg", "badgeBg"],
                        ["Badge Text", "badgeText"],
                      ] as [string, keyof StyleLocal][]
                    ).map(([label, key]) => (
                      <div key={key}>
                        <span style={{ fontSize: "11px", color: "#71717a", display: "block", marginBottom: "3px" }}>
                          {label}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <input
                            type="color"
                            value={style[key] as string}
                            onChange={(e) => updateStyle({ [key]: e.target.value })}
                            style={{ width: "28px", height: "28px", borderRadius: "4px", border: "1px solid #d4d4d8", cursor: "pointer", padding: "1px" }}
                          />
                          <span style={{ fontSize: "11px", color: "#52525b", fontFamily: "monospace" }}>
                            {style[key] as string}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Deal Bars (Tiers) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              padding: "10px 14px",
              fontSize: "13px",
              fontWeight: 700,
              color: "#52525b",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            Deal Bars
          </div>

          {tiers.map((tier, i) => (
            <div
              key={tier.id}
              style={{
                background: "#fff",
                border: "1px solid #e4e4e7",
                borderRadius: "10px",
                marginBottom: "6px",
                overflow: "hidden",
              }}
            >
              {/* Tier Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "10px 12px",
                  cursor: "pointer",
                  gap: "8px",
                  background: expandedTier === tier.id ? "#fafafa" : "#fff",
                  borderBottom: expandedTier === tier.id ? "1px solid #e4e4e7" : "none",
                }}
                onClick={() =>
                  setExpandedTier(expandedTier === tier.id ? null : tier.id)
                }
              >
                {/* Drag handle */}
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", cursor: "grab" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveTierUp(i); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "1px", fontSize: "10px", color: "#a1a1aa" }}
                    title="Move up"
                  >
                    ▲
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); moveTierDown(i); }}
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "1px", fontSize: "10px", color: "#a1a1aa" }}
                    title="Move down"
                  >
                    ▼
                  </button>
                </div>
                <span style={{ fontSize: "14px" }}>📊</span>
                <span style={{ flex: 1, fontWeight: 600, fontSize: "13px", color: "#18181b" }}>
                  Bar #{i + 1} — {tier.label}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeTier(tier.id); }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#ef4444",
                    fontSize: "16px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                  }}
                  title="Remove tier"
                >
                  ×
                </button>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  style={{ transform: expandedTier === tier.id ? "rotate(180deg)" : "rotate(0)", transition: "transform 0.2s" }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Tier Body */}
              {expandedTier === tier.id && (
                <div style={{ padding: "12px" }}>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={labelStyle}>Label</label>
                    <input
                      type="text"
                      value={tier.label}
                      onChange={(e) => updateTier(tier.id, { label: e.target.value })}
                      style={inputStyle}
                      placeholder="e.g. Single, Duo, Best Value"
                    />
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={labelStyle}>Quantity</label>
                    <input
                      type="number"
                      min={1}
                      value={tier.quantity}
                      onChange={(e) => updateTier(tier.id, { quantity: Number(e.target.value) })}
                      style={{ ...inputStyle, width: "80px" }}
                    />
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={labelStyle}>Discount Type</label>
                    <select
                      value={tier.discountType}
                      onChange={(e) =>
                        updateTier(tier.id, {
                          discountType: e.target.value as TierLocal["discountType"],
                        })
                      }
                      style={{ ...inputStyle, cursor: "pointer" }}
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount ($)</option>
                      <option value="price">Specific Price ($)</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: "10px" }}>
                    <label style={labelStyle}>
                      {tier.discountType === "percentage"
                        ? "Discount %"
                        : tier.discountType === "fixed"
                        ? "Discount Amount ($)"
                        : "Specific Price ($)"}
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={tier.discountType === "percentage" ? 1 : 0.01}
                      value={tier.discountValue}
                      onChange={(e) =>
                        updateTier(tier.id, { discountValue: Number(e.target.value) })
                      }
                      style={{ ...inputStyle, width: "100px" }}
                    />
                  </div>
                  <div>
                    <label style={{ ...radioRowStyle, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={tier.isBadgeEnabled}
                        onChange={(e) =>
                          updateTier(tier.id, { isBadgeEnabled: e.target.checked })
                        }
                        style={{ accentColor: "#09090b", width: "15px", height: "15px" }}
                      />
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>Show Badge</span>
                    </label>
                    {tier.isBadgeEnabled && (
                      <input
                        type="text"
                        value={tier.badge}
                        onChange={(e) => updateTier(tier.id, { badge: e.target.value })}
                        placeholder="e.g. Most Popular"
                        style={{ ...inputStyle, marginTop: "6px" }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add Bar button */}
          <button
            onClick={addTier}
            style={{
              width: "100%",
              padding: "10px",
              border: "1px dashed #d4d4d8",
              borderRadius: "10px",
              background: "#fff",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              color: "#52525b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              marginTop: "4px",
              marginBottom: "20px",
            }}
          >
            <span style={{ fontSize: "18px", lineHeight: 1 }}>+</span> Add bar
          </button>

          {/* Coming soon modules */}
          {["Countdown Timer", "Checkbox Upsells", "Progressive Gifts", "Sticky Cart"].map(
            (mod) => (
              <div
                key={mod}
                style={{
                  ...sectionStyle,
                  opacity: 0.55,
                  pointerEvents: "none",
                }}
              >
                <div style={{ ...sectionHeaderStyle(false), justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 600, fontSize: "13px", color: "#71717a" }}>{mod}</span>
                  <span
                    style={{
                      fontSize: "10px",
                      background: "#f4f4f5",
                      color: "#71717a",
                      padding: "2px 8px",
                      borderRadius: "100px",
                      fontWeight: 600,
                    }}
                  >
                    Coming Soon
                  </span>
                </div>
              </div>
            )
          )}
        </div>

        {/* ── Right: Live Preview ── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            padding: "28px 32px",
            overflowY: "auto",
            background: "#f4f4f5",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "560px",
              background: "#fff",
              borderRadius: "14px",
              border: "1px solid #e4e4e7",
              overflow: "hidden",
              boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
            }}
          >
            {/* Preview header */}
            <div
              style={{
                padding: "12px 16px",
                background: "#fafafa",
                borderBottom: "1px solid #e4e4e7",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#52525b" }}>
                🔍 Live Preview
              </span>
              <span style={{ fontSize: "11px", color: "#a1a1aa" }}>
                Updates in real-time
              </span>
            </div>

            {/* Mock product context */}
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #f0f0f0",
                display: "flex",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "8px",
                  background: "linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%)",
                  flexShrink: 0,
                }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: "15px", color: "#09090b" }}>
                  Sample Product
                </div>
                <div style={{ fontSize: "13px", color: "#71717a" }}>
                  ${baseMockPrice} per unit
                </div>
              </div>
            </div>

            {/* The actual widget preview */}
            <div style={{ padding: "16px 20px" }}>
              {/* Block Title */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginBottom: "14px",
                }}
              >
                <div style={{ flex: 1, height: "1px", background: "#e4e4e7" }} />
                <span
                  style={{
                    fontSize: `${style.blockTitleSize || 14}px`,
                    fontWeight: style.blockTitleStyle === "bold" ? 700 : 400,
                    color: style.blockTitleColor,
                    letterSpacing: "1px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {blockTitle || "BUNDLE & SAVE"}
                </span>
                <div style={{ flex: 1, height: "1px", background: "#e4e4e7" }} />
              </div>

              {/* Tier rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: `${style.spacing || 10}px` }}>
                {tiers.map((tier, i) => {
                  const isSelected = previewSelected === i;
                  const { display, original } = computePrice(tier);
                  const save = savePct(tier);
                  return (
                    <div
                      key={tier.id}
                      onClick={() => setPreviewSelected(i)}
                      style={{
                        border: `1.5px solid ${isSelected ? style.borderColor : "#e4e4e7"}`,
                        borderRadius: `${style.cornerRadius}px`,
                        background: isSelected ? style.selectedBg : style.cardsBg,
                        padding: "12px 14px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        transition: "all 0.15s ease",
                        position: "relative",
                      }}
                    >
                      {/* Radio */}
                      <div
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "50%",
                          border: `2px solid ${isSelected ? style.borderColor : "#d4d4d8"}`,
                          background: isSelected ? style.borderColor : "transparent",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {isSelected && (
                          <div
                            style={{
                              width: "7px",
                              height: "7px",
                              borderRadius: "50%",
                              background: "#fff",
                            }}
                          />
                        )}
                      </div>

                      {/* Label */}
                      <div style={{ flex: 1 }}>
                        <span
                          style={{
                            fontWeight: style.titleStyle === "bold" ? 700 : 500,
                            fontSize: `${style.titleSize || 15}px`,
                            color: style.titleColor,
                          }}
                        >
                          {tier.label}
                        </span>
                        {save > 0 && (
                          <span
                            style={{
                              marginLeft: "8px",
                              fontSize: "11px",
                              fontWeight: 700,
                              background: style.labelBg,
                              color: style.labelText,
                              padding: "2px 7px",
                              borderRadius: "100px",
                            }}
                          >
                            SAVE {save}%
                          </span>
                        )}
                      </div>

                      {/* Price */}
                      <div style={{ textAlign: "right" }}>
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "14px",
                            color: style.priceColor,
                          }}
                        >
                          ${display}
                        </div>
                        {save > 0 && (
                          <div
                            style={{
                              fontSize: "12px",
                              color: style.fullPriceColor,
                              textDecoration: "line-through",
                            }}
                          >
                            ${original}
                          </div>
                        )}
                      </div>

                      {/* Badge */}
                      {tier.isBadgeEnabled && tier.badge && (
                        <div
                          style={{
                            position: "absolute",
                            top: "-10px",
                            right: "10px",
                            background: style.badgeBg,
                            color: style.badgeText,
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "100px",
                            letterSpacing: "0.3px",
                          }}
                        >
                          {tier.badge}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Mock Add to Cart button */}
              <button
                style={{
                  width: "100%",
                  marginTop: "16px",
                  padding: "12px",
                  background: "#09090b",
                  color: "#fff",
                  border: "none",
                  borderRadius: `${style.cornerRadius}px`,
                  fontSize: "14px",
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.3px",
                }}
              >
                🛒 Add to cart — ${computePrice(tiers[previewSelected] || tiers[0]).display}
              </button>
            </div>
          </div>

          {/* Info note */}
          <div
            style={{
              marginTop: "20px",
              padding: "12px 16px",
              background: "#f0fdf4",
              border: "1px solid #bbf7d0",
              borderRadius: "8px",
              fontSize: "12px",
              color: "#166534",
              maxWidth: "560px",
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <span style={{ fontSize: "16px" }}>✅</span>
            <span>
              <strong>When you publish</strong>, this widget will automatically appear on your
              product pages — no theme editor setup needed after the initial App Embed activation.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
