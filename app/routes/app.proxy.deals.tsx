import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getActiveDealForProduct } from "../models/deal.server";

/**
 * App Proxy Route — handles requests from storefront widget.
 *
 * Shopify forwards requests from:
 *   https://{store}.myshopify.com/apps/bundlify/*
 * to our backend at:
 *   /app/proxy/*
 *
 * The widget on the storefront calls:
 *   GET /apps/bundlify/deal?product_id=gid://shopify/Product/12345
 *
 * We look up the active deal for that product and return it as JSON.
 */
export const loader = async ({ request }: LoaderFunctionArgs) => {
  // CORS headers for storefront fetch
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=30", // cache 30s on CDN
  };

  // Validate that the request is from Shopify (HMAC check)
  const { session } = await authenticate.public.appProxy(request);
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }
  const shop = session.shop;

  const url = new URL(request.url);
  const productId = url.searchParams.get("product_id");
  const path = url.searchParams.get("path") || url.pathname;


  // Handle /apps/bundlify/deal?product_id=...
  if (productId) {
    try {
      const deal = await getActiveDealForProduct(shop, productId);

      if (!deal) {
        return new Response(JSON.stringify({ deal: null }), {
          status: 200,
          headers: corsHeaders,
        });
      }

      // Return a clean, public-safe deal object (no internal fields)
      const publicDeal = {
        id: deal.id,
        blockTitle: deal.blockTitle,
        dealType: deal.dealType,
        skipCart: deal.skipCart,
        showPricePerItem: deal.showPricePerItem,
        useCompareAtPrice: deal.useCompareAtPrice,
        allowVariantPerItem: deal.allowVariantPerItem,
        showVariantForSingle: deal.showVariantForSingle,
        hideThemeVariantPicker: deal.hideThemeVariantPicker,
        hideUnavailableVariants: deal.hideUnavailableVariants,
        tiers: deal.tiers.map((t: any) => ({
          id: t.id,
          position: t.position,
          label: t.label,
          quantity: t.quantity,
          discountType: t.discountType,
          discountValue: t.discountValue,
          badge: t.badge,
          isBadgeEnabled: t.isBadgeEnabled,
          scratchOff: t.scratchOff,
        })),
        style: deal.style
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
          : null,
      };

      return new Response(JSON.stringify({ deal: publicDeal }), {
        status: 200,
        headers: corsHeaders,
      });
    } catch (error) {
      console.error("[App Proxy] Error fetching deal:", error);
      return new Response(JSON.stringify({ deal: null, error: "server_error" }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  // Default: unknown path
  return new Response(JSON.stringify({ error: "not_found" }), {
    status: 404,
    headers: corsHeaders,
  });
};
