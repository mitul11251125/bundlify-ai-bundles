(function () {
  console.log("Bundlify App Embed: Checking product context...");

  // 1. Double check: Only run on Product Pages
  const isProductPage = window.location.pathname.includes("/products/");
  if (!isProductPage && !window.ShopifyAnalytics?.meta?.page?.pageType?.includes("product")) {
    return;
  }

  // 2. Fetch current Product GID or ID
  let productId = null;
  if (window.ShopifyAnalytics?.meta?.product?.id) {
    productId = window.ShopifyAnalytics.meta.product.id;
  } else if (window.meta?.product?.id) {
    productId = window.meta.product.id;
  } else {
    // Fallback: search DOM for product JSON
    const productJsonEl = document.querySelector('script[type="application/json"][data-product-json]');
    if (productJsonEl) {
      try {
        const data = JSON.parse(productJsonEl.textContent);
        productId = data.id;
      } catch (e) {}
    }
  }

  if (!productId) {
    console.warn("Bundlify App Embed: Could not find Product ID on page.");
    return;
  }

  // Convert raw number ID to Shopify GraphQL GID if needed
  const productGid = String(productId).startsWith("gid://") 
    ? productId 
    : `gid://shopify/Product/${productId}`;

  console.log("Bundlify App Embed: Found Product GID:", productGid);

  // 3. Fetch active deal via App Proxy
  fetch(`/apps/bundlify/deals?product_id=${encodeURIComponent(productGid)}`)
    .then((response) => response.json())
    .then((data) => {
      if (!data || !data.deal) {
        console.log("Bundlify App Embed: No active deal found for this product.");
        return;
      }

      renderWidget(data.deal);
    })
    .catch((err) => {
      console.error("Bundlify App Embed: Error fetching deal data:", err);
    });

  // ─── Widget Render Logic ───────────────────────────────────────────────────

  function renderWidget(deal) {
    console.log("Bundlify App Embed: Rendering widget for deal:", deal.name);

    // Predictable selectors for Shopify themes Add-To-Cart buttons
    const ATC_SELECTORS = [
      'button[name="add"]',
      '.product-form__submit',
      '[data-add-to-cart]',
      '.add-to-cart-btn',
      '#AddToCart',
      '#add-to-cart',
      'form[action="/cart/add"] button[type="submit"]',
    ];

    let atcButton = null;
    for (const selector of ATC_SELECTORS) {
      atcButton = document.querySelector(selector);
      if (atcButton) break;
    }

    if (!atcButton) {
      console.warn("Bundlify App Embed: Could not find Add to Cart button to inject widget.");
      return;
    }

    // Check if we already rendered the widget
    if (document.getElementById(`bundlify-widget-${deal.id}`)) {
      return;
    }

    // Create wrapper
    const widgetContainer = document.createElement("div");
    widgetContainer.id = `bundlify-widget-${deal.id}`;
    widgetContainer.className = "bundlify-widget-container";

    // CSS variables configuration for dynamic style config from dashboard settings
    const style = deal.style || {};
    const cssVars = `
      --border-color: ${style.borderColor || "#000000"};
      --cards-bg: ${style.cardsBg || "#ffffff"};
      --selected-bg: ${style.selectedBg || "#f0f5ff"};
      --title-color: ${style.titleColor || "#000000"};
      --subtitle-color: ${style.subtitleColor || "#6d7175"};
      --price-color: ${style.priceColor || "#000000"};
      --full-price-color: ${style.fullPriceColor || "#8c9196"};
      --label-bg: ${style.labelBg || "#e3e3e3"};
      --label-text: ${style.labelText || "#000000"};
      --badge-bg: ${style.badgeBg || "#000000"};
      --badge-text: ${style.badgeText || "#ffffff"};
    `;
    widgetContainer.setAttribute("style", cssVars);

    // A. Block Title
    const titleWrapper = document.createElement("div");
    titleWrapper.className = "bundlify-block-title-wrapper";
    
    const lineLeft = document.createElement("div");
    lineLeft.className = "bundlify-block-title-line";
    
    const titleSpan = document.createElement("span");
    titleSpan.className = "bundlify-block-title";
    titleSpan.textContent = deal.blockTitle || "BUNDLE & SAVE";
    titleSpan.style.fontSize = `${style.blockTitleSize || 14}px`;
    titleSpan.style.fontWeight = style.blockTitleStyle === "bold" ? "700" : "400";
    titleSpan.style.color = style.blockTitleColor || "#000000";

    const lineRight = document.createElement("div");
    lineRight.className = "bundlify-block-title-line";

    titleWrapper.appendChild(lineLeft);
    titleWrapper.appendChild(titleSpan);
    titleWrapper.appendChild(lineRight);
    widgetContainer.appendChild(titleWrapper);

    // B. Tiers list
    const tiersList = document.createElement("div");
    const layoutClass = `bundlify-layout-${style.layoutPreset || "card"}`;
    tiersList.className = `bundlify-tiers-list ${layoutClass}`;

    let selectedTierIndex = 0; // Default select first tier

    // Mock calculations (fetch base price from Shopify storefront theme variables or DOM)
    let basePrice = 29.99;
    const priceScript = document.querySelector('script[type="application/json"][data-product-json]');
    if (priceScript) {
      try {
        const parsed = JSON.parse(priceScript.textContent);
        if (parsed.price) basePrice = parsed.price / 100;
        else if (parsed.variants?.[0]?.price) basePrice = parsed.variants[0].price / 100;
      } catch (e) {}
    } else {
      // Fetch from meta theme tags if available
      const priceMeta = document.querySelector('meta[property="og:price:amount"]');
      if (priceMeta) {
        basePrice = parseFloat(priceMeta.getAttribute("content")) || 29.99;
      }
    }

    // Build row nodes
    const rows = deal.tiers.map((tier, idx) => {
      const row = document.createElement("div");
      row.className = `bundlify-tier-row ${idx === selectedTierIndex ? "active" : ""}`;
      row.style.borderRadius = `${style.cornerRadius || 8}px`;
      row.style.borderColor = idx === selectedTierIndex ? (style.borderColor || "#000000") : "#e4e4e7";
      row.style.background = idx === selectedTierIndex ? (style.selectedBg || "#f0f5ff") : (style.cardsBg || "#ffffff");

      // Radio box
      const radioOuter = document.createElement("div");
      radioOuter.className = "bundlify-radio-outer";
      const radioInner = document.createElement("div");
      radioInner.className = "bundlify-radio-inner";
      radioOuter.appendChild(radioInner);
      row.appendChild(radioOuter);

      // Label group
      const labelGroup = document.createElement("div");
      labelGroup.className = "bundlify-tier-label-group";
      const labelSpan = document.createElement("span");
      labelSpan.className = "bundlify-tier-label";
      labelSpan.style.fontSize = `${style.titleSize || 15}px`;
      labelSpan.style.fontWeight = style.titleStyle === "bold" ? "700" : "500";
      labelSpan.textContent = tier.label;
      labelGroup.appendChild(labelSpan);

      // Save savings badge
      let originalTotal = basePrice * tier.quantity;
      let discountedTotal = originalTotal;
      let pct = 0;

      if (tier.discountType === "percentage") {
        pct = tier.discountValue;
        discountedTotal = originalTotal * (1 - pct / 100);
      } else if (tier.discountType === "fixed") {
        discountedTotal = originalTotal - tier.discountValue;
        pct = Math.round(((originalTotal - discountedTotal) / originalTotal) * 100);
      } else if (tier.discountType === "price") {
        discountedTotal = tier.discountValue;
        pct = Math.round(((originalTotal - discountedTotal) / originalTotal) * 100);
      }

      if (pct > 0) {
        const saveBadge = document.createElement("span");
        saveBadge.className = "bundlify-tier-save-badge";
        saveBadge.textContent = `SAVE ${pct}%`;
        labelGroup.appendChild(saveBadge);
      }
      row.appendChild(labelGroup);

      // Prices group
      const priceGroup = document.createElement("div");
      priceGroup.className = "bundlify-price-group";
      
      const priceDisplay = document.createElement("div");
      priceDisplay.className = "bundlify-price-display";
      priceDisplay.textContent = `$${discountedTotal.toFixed(2)}`;
      priceGroup.appendChild(priceDisplay);

      if (pct > 0) {
        const originalPrice = document.createElement("div");
        originalPrice.className = "bundlify-original-price";
        originalPrice.textContent = `$${originalTotal.toFixed(2)}`;
        priceGroup.appendChild(originalPrice);
      }
      row.appendChild(priceGroup);

      // Top highlight badge
      if (tier.isBadgeEnabled && tier.badge) {
        const topBadge = document.createElement("div");
        topBadge.className = "bundlify-tier-top-badge";
        topBadge.textContent = tier.badge;
        row.appendChild(topBadge);
      }

      // Event listener for select tier
      row.addEventListener("click", () => {
        selectedTierIndex = idx;
        
        // Remove active class from all rows
        rows.forEach((r, rIdx) => {
          r.className = `bundlify-tier-row ${rIdx === selectedTierIndex ? "active" : ""}`;
          r.style.borderColor = rIdx === selectedTierIndex ? (style.borderColor || "#000000") : "#e4e4e7";
          r.style.background = rIdx === selectedTierIndex ? (style.selectedBg || "#f0f5ff") : (style.cardsBg || "#ffffff");
        });

        // Trigger updates to parent checkout flow
        updateShopifyATCBehavior(deal, tier);
      });

      return row;
    });

    rows.forEach((row) => tiersList.appendChild(row));
    widgetContainer.appendChild(tiersList);

    // C. Inject widget right above the Add to Cart button
    atcButton.parentNode.insertBefore(widgetContainer, atcButton);
    
    // D. Initial setup on load
    updateShopifyATCBehavior(deal, deal.tiers[selectedTierIndex]);
  }

  // ─── Cart and Quantity Update Interceptors ─────────────────────────────────

  function updateShopifyATCBehavior(deal, activeTier) {
    // Dynamic override of Shopify native Product Form input values
    const productForm = document.querySelector('form[action="/cart/add"]');
    if (!productForm) return;

    // A. Sync Quantity
    let qtyInput = productForm.querySelector('input[name="quantity"]');
    if (!qtyInput) {
      qtyInput = document.createElement("input");
      qtyInput.type = "hidden";
      qtyInput.name = "quantity";
      productForm.appendChild(qtyInput);
    }
    qtyInput.value = activeTier.quantity;

    // B. Custom bundle parameters injection
    let dealIdInput = productForm.querySelector('input[name="properties[_bundlify_deal_id]"]');
    if (!dealIdInput) {
      dealIdInput = document.createElement("input");
      dealIdInput.type = "hidden";
      dealIdInput.name = "properties[_bundlify_deal_id]";
      productForm.appendChild(dealIdInput);
    }
    dealIdInput.value = deal.id;

    // Optional: Hide native quantity selectors from theme if deal forces single-item select
    const themeQtySelectors = document.querySelectorAll(".quantity, .product-form__quantity, [data-quantity-input]");
    themeQtySelectors.forEach((selector) => {
      selector.style.display = "none";
    });

    console.log(`Bundlify App Embed: Selected quantity sync ${activeTier.quantity} items for deal ${deal.name}`);
  }
})();
