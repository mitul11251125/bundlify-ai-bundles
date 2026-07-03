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

  // Outer closure variables
  let basePrice = 29.99;
  let productVariants = [];

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

    // Optional: Hide native variant selector elements from theme
    if (deal.hideThemeVariantPicker) {
      const themeVariantSelects = document.querySelectorAll(
        '.product-form__input--select, .product-form__input--radio, [data-section] select, .product-form__variants, [id^="Option-"], [id^="OptionVal-"]'
      );
      themeVariantSelects.forEach((el) => {
        el.style.display = "none";
      });
    }

    // ── Progressive Gifts Banner ──
    if (deal.giftsEnabled) {
      const giftWrapper = document.createElement("div");
      giftWrapper.id = "bundlify-gifts-milestone-wrapper";
      giftWrapper.style.padding = "10px 14px";
      giftWrapper.style.background = "#f8fafc";
      giftWrapper.style.border = "1px solid #e2e8f0";
      giftWrapper.style.borderRadius = `${style.cornerRadius || 8}px`;
      giftWrapper.style.marginBottom = "14px";
      giftWrapper.style.fontFamily = "inherit";
      widgetContainer.appendChild(giftWrapper);
    }

    // ── Countdown Banner ──
    if (deal.countdownEnabled) {
      const countdownBanner = document.createElement("div");
      countdownBanner.style.background = deal.countdownBg || "#fef2f2";
      countdownBanner.style.color = deal.countdownColor || "#ef4444";
      countdownBanner.style.padding = "8px 12px";
      countdownBanner.style.borderRadius = `${style.cornerRadius || 6}px`;
      countdownBanner.style.fontSize = "13px";
      countdownBanner.style.fontWeight = "600";
      countdownBanner.style.textAlign = "center";
      countdownBanner.style.marginBottom = "12px";
      countdownBanner.style.border = `1px solid ${deal.countdownColor || "#ef4444"}33`;
      
      let durationSeconds = (deal.countdownDuration || 15) * 60;
      
      const updateTimerDisplay = () => {
        const mins = Math.floor(durationSeconds / 60);
        const secs = durationSeconds % 60;
        const timeStr = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
        countdownBanner.textContent = `⏱️ ` + (deal.countdownText || "Limited time offer ends in {{timer}}!").replace("{{timer}}", timeStr);
      };
      
      updateTimerDisplay();
      
      const interval = setInterval(() => {
        if (durationSeconds <= 0) {
          clearInterval(interval);
          countdownBanner.style.display = "none";
          return;
        }
        durationSeconds--;
        updateTimerDisplay();
      }, 1000);
      
      widgetContainer.appendChild(countdownBanner);
    }

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
    titleSpan.style.color = style.blockTitleColor || "#1e293b";
    
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

    // Parse product json data
    const priceScript = document.querySelector('script[type="application/json"][data-product-json]');
    if (priceScript) {
      try {
        const parsed = JSON.parse(priceScript.textContent);
        if (parsed.price) basePrice = parsed.price / 100;
        else if (parsed.variants?.[0]?.price) basePrice = parsed.variants[0].price / 100;
        productVariants = parsed.variants || [];
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
        pct = Math.round((tier.discountValue / originalTotal) * 100);
      } else if (tier.discountType === "price") {
        discountedTotal = tier.discountValue;
        pct = Math.round(((originalTotal - discountedTotal) / originalTotal) * 100);
      }

      // Rounded pricing settings
      if (deal.priceRounding && pct > 0) {
        discountedTotal = Math.round(discountedTotal) - 0.01;
      }

      if (pct > 0) {
        const saveBadge = document.createElement("span");
        saveBadge.className = "bundlify-save-badge";
        saveBadge.style.fontSize = `${style.labelSize || 11}px`;
        saveBadge.style.background = style.labelBg || "#e3e3e3";
        saveBadge.style.color = style.labelText || "#000000";
        saveBadge.textContent = `SAVE ${pct}%`;
        labelGroup.appendChild(saveBadge);
      }
      row.appendChild(labelGroup);

      // Pricing group
      const priceGroup = document.createElement("div");
      priceGroup.className = "bundlify-price-group";

      const priceDisplay = document.createElement("div");
      priceDisplay.className = "bundlify-discount-price";
      priceDisplay.style.fontSize = `${style.priceSize || 16}px`;

      let displayPriceStr = "";
      let originalPriceStr = "";

      if (deal.showPricePerItem) {
        const perItemPrice = discountedTotal / tier.quantity;
        if (deal.showPricesWithoutDecimals) {
          displayPriceStr = `$${Math.round(perItemPrice)}/item`;
          originalPriceStr = `$${Math.round(basePrice)}/item`;
        } else {
          displayPriceStr = `$${perItemPrice.toFixed(2)}/item`;
          originalPriceStr = `$${basePrice.toFixed(2)}/item`;
        }
      } else {
        if (deal.showPricesWithoutDecimals) {
          displayPriceStr = `$${Math.round(discountedTotal)}`;
          originalPriceStr = `$${Math.round(originalTotal)}`;
        } else {
          displayPriceStr = `$${discountedTotal.toFixed(2)}`;
          originalPriceStr = `$${originalTotal.toFixed(2)}`;
        }
      }
      
      priceDisplay.textContent = displayPriceStr;
      priceGroup.appendChild(priceDisplay);

      if (pct > 0) {
        const originalPrice = document.createElement("div");
        originalPrice.className = "bundlify-original-price";
        originalPrice.textContent = originalPriceStr;
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
          
          // Clear variant container in other rows
          const existing = r.querySelector(".bundlify-variant-selectors-container");
          if (existing) existing.remove();
        });

        // Render variant selectors in the active row if enabled
        if (deal.allowVariantPerItem && productVariants.length > 1) {
          renderVariantDropdowns(row, tier, productVariants);
        }

        // Trigger updates to parent checkout flow
        updateShopifyATCBehavior(deal, tier);
      });

      return row;
    });

    rows.forEach((row) => tiersList.appendChild(row));
    widgetContainer.appendChild(tiersList);

    // Render variant dropdowns inside the active row on initial load
    if (deal.allowVariantPerItem && productVariants.length > 1 && rows[selectedTierIndex]) {
      renderVariantDropdowns(rows[selectedTierIndex], deal.tiers[selectedTierIndex], productVariants);
    }

    // Helper: Render variant select dropdowns for each item in active tier
    function renderVariantDropdowns(rowNode, tierObj, variantsList) {
      const container = document.createElement("div");
      container.className = "bundlify-variant-selectors-container";
      container.style.marginTop = "10px";
      container.style.paddingTop = "10px";
      container.style.borderTop = "1px dashed #e2e8f0";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.gap = "8px";
      container.style.width = "100%";

      for (let i = 0; i < tierObj.quantity; i++) {
        const itemRow = document.createElement("div");
        itemRow.style.display = "flex";
        itemRow.style.alignItems = "center";
        itemRow.style.justifyContent = "space-between";
        itemRow.style.fontSize = "12px";

        const label = document.createElement("span");
        label.textContent = `Product #${i + 1}:`;
        label.style.fontWeight = "600";
        label.style.color = "#4b5563";
        itemRow.appendChild(label);

        const select = document.createElement("select");
        select.className = "bundlify-variant-select-item";
        select.style.padding = "4px 8px";
        select.style.border = "1px solid #cbd5e1";
        select.style.borderRadius = "4px";
        select.style.background = "#ffffff";
        select.style.fontSize = "12px";
        select.style.outline = "none";
        select.style.maxWidth = "200px";

        variantsList.forEach(v => {
          if (deal.hideUnavailableVariants && !v.available) return;

          const opt = document.createElement("option");
          opt.value = v.id;
          opt.textContent = v.title + (v.available ? "" : " (Out of stock)");
          opt.disabled = !v.available;
          select.appendChild(opt);
        });

        itemRow.appendChild(select);
        container.appendChild(itemRow);
      }

      // Prevent collapse on click dropdown
      container.addEventListener("click", (e) => e.stopPropagation());
      rowNode.appendChild(container);
    }

    // ── Checkbox Upsells Banner ──
    if (deal.upsellsEnabled) {
      const upsellCard = document.createElement("div");
      upsellCard.style.marginTop = "12px";
      upsellCard.style.padding = "10px 12px";
      upsellCard.style.border = "1px solid #e4e4e7";
      upsellCard.style.borderRadius = `${style.cornerRadius || 8}px`;
      upsellCard.style.background = "#fdfdfd";
      upsellCard.style.display = "flex";
      upsellCard.style.alignItems = "center";
      upsellCard.style.gap = "10px";
      upsellCard.style.cursor = "pointer";
      upsellCard.style.userSelect = "none";
      upsellCard.style.fontFamily = "inherit";

      const upsellCheckbox = document.createElement("input");
      upsellCheckbox.type = "checkbox";
      upsellCheckbox.checked = true;
      upsellCheckbox.style.accentColor = style.borderColor || "#000000";
      upsellCheckbox.style.width = "16px";
      upsellCheckbox.style.height = "16px";
      upsellCheckbox.style.cursor = "pointer";

      const upsellInfo = document.createElement("div");
      upsellInfo.style.flex = 1;
      
      const upsellTitle = document.createElement("div");
      upsellTitle.style.fontSize = "13px";
      upsellTitle.style.fontWeight = "600";
      upsellTitle.style.color = "#1a1a1a";
      upsellTitle.textContent = deal.upsellText || "Add additional warranty protection";

      const upsellPriceTag = document.createElement("div");
      upsellPriceTag.style.fontSize = "11.5px";
      upsellPriceTag.style.color = "#6d7175";
      upsellPriceTag.textContent = `+$${(deal.upsellPrice || 4.99).toFixed(2)}`;

      upsellInfo.appendChild(upsellTitle);
      upsellInfo.appendChild(upsellPriceTag);

      upsellCard.appendChild(upsellCheckbox);
      upsellCard.appendChild(upsellInfo);

      upsellCard.addEventListener("click", (e) => {
        if (e.target !== upsellCheckbox) {
          upsellCheckbox.checked = !upsellCheckbox.checked;
        }
        updateUpsellProductProperties(upsellCheckbox.checked, deal.upsellProduct, deal.upsellPrice);
      });

      widgetContainer.appendChild(upsellCard);
      
      // Init Upsell attributes
      updateUpsellProductProperties(true, deal.upsellProduct, deal.upsellPrice);
    }

    // ── Low Stock Alert Banner ──
    if (deal.lowStockAlert) {
      const stockAlert = document.createElement("div");
      stockAlert.style.marginTop = "12px";
      stockAlert.style.padding = "8px 12px";
      stockAlert.style.background = "#fffbeb";
      stockAlert.style.border = "1px dashed #f59e0b";
      stockAlert.style.borderRadius = `${style.cornerRadius || 6}px`;
      stockAlert.style.fontSize = "12px";
      stockAlert.style.color = "#b45309";
      stockAlert.style.fontWeight = "600";
      stockAlert.style.display = "flex";
      stockAlert.style.alignItems = "center";
      stockAlert.style.gap = "6px";
      stockAlert.textContent = "🔥 Warning: Low stock! Items in this bundle are selling out fast.";
      widgetContainer.appendChild(stockAlert);
    }

    // C. Inject widget right above the Add to Cart button
    atcButton.parentNode.insertBefore(widgetContainer, atcButton);
    
    // D. Batch Add-to-Cart form submit interceptor (Handles multiple variants & skipCart)
    const productFormEl = document.querySelector('form[action="/cart/add"]');
    if (productFormEl) {
      productFormEl.addEventListener("submit", function (e) {
        const activeRow = tiersList.querySelector(".bundlify-tier-row.active");
        if (!activeRow) return;

        const selectDropdowns = activeRow.querySelectorAll(".bundlify-variant-select-item");
        
        // CASE 1: Allow variants per item is active and dropdowns are rendered
        if (selectDropdowns.length > 0) {
          e.preventDefault();

          if (atcButton) {
            atcButton.disabled = true;
            atcButton.textContent = "Adding bundle to cart...";
          }

          const itemsPayload = [];
          const qtyMap = {};
          
          selectDropdowns.forEach(select => {
            const variantId = select.value;
            qtyMap[variantId] = (qtyMap[variantId] || 0) + 1;
          });

          for (const [variantId, qty] of Object.entries(qtyMap)) {
            itemsPayload.push({
              id: Number(variantId),
              quantity: qty,
              properties: {
                "_bundlify_deal_id": deal.id
              }
            });
          }

          fetch("/cart/add.js", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ items: itemsPayload })
          })
          .then(res => res.json())
          .then(() => {
            if (deal.skipCart) {
              window.location.href = "/checkout";
            } else {
              window.location.href = "/cart";
            }
          })
          .catch(err => {
            console.error("Bundlify add to cart error:", err);
            window.location.href = "/cart";
          });
        } 
        // CASE 2: No multiple variants dropdowns, but skipCart is enabled
        else if (deal.skipCart) {
          e.preventDefault();
          const formData = new FormData(productFormEl);

          if (atcButton) {
            atcButton.disabled = true;
            atcButton.textContent = "Redirecting to checkout...";
          }

          fetch("/cart/add.js", {
            method: "POST",
            body: formData
          })
          .then(() => {
            window.location.href = "/checkout";
          })
          .catch(() => {
            window.location.href = "/checkout";
          });
        }
      });
    }

    // E. Initial setup on load
    updateShopifyATCBehavior(deal, deal.tiers[selectedTierIndex]);
  }

  // ─── Cart and Quantity Update Interceptors ─────────────────────────────────

  function updateShopifyATCBehavior(deal, activeTier) {
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

    // C. Dynamic Gift Milestone Progress update
    let originalTotal = basePrice * activeTier.quantity;
    let discountedTotal = originalTotal;
    if (activeTier.discountType === "percentage") {
      discountedTotal = originalTotal * (1 - activeTier.discountValue / 100);
    } else if (activeTier.discountType === "fixed") {
      discountedTotal = originalTotal - activeTier.discountValue;
    } else if (activeTier.discountType === "price") {
      discountedTotal = activeTier.discountValue;
    }

    // Rounding configuration
    if (deal.priceRounding) {
      discountedTotal = Math.round(discountedTotal) - 0.01;
    }

    if (deal.giftsEnabled) {
      const giftWrapper = document.getElementById("bundlify-gifts-milestone-wrapper");
      if (giftWrapper) {
        const giftThreshold = deal.giftThreshold || 75;
        const progressPct = Math.min((discountedTotal / giftThreshold) * 100, 100);
        const remaining = Math.max(giftThreshold - discountedTotal, 0).toFixed(2);
        const giftProduct = deal.giftProduct || "Free Gift";
        const message = remaining === "0.00" 
          ? `🎉 Congratulations! You unlocked a ${giftProduct}!`
          : (deal.giftText || "Spend ${{remaining}} more to get a {{gift}}!")
              .replace("{{remaining}}", remaining)
              .replace("{{gift}}", giftProduct);

        giftWrapper.innerHTML = `
          <div style="display: flex; justify-content: space-between; font-size: 12.5px; font-weight: 600; color: #1e293b; margin-bottom: 6px;">
            <span>Progress: $${discountedTotal.toFixed(2)} / $${giftThreshold.toFixed(2)}</span>
            <span style="color: ${remaining === "0.00" ? "#16a34a" : "#64748b"}; font-size: 11px;">
              ${remaining === "0.00" ? "Unlocked!" : "Locked"}
            </span>
          </div>
          <div style="width: 100%; height: 6px; background: #cbd5e1; border-radius: 100px; overflow: hidden; margin-bottom: 6px;">
            <div style="width: ${progressPct}%; height: 100%; background: ${remaining === "0.00" ? "#22c55e" : "#000000"}; transition: width 0.2s ease;"></div>
          </div>
          <div style="font-size: 11.5px; color: ${remaining === "0.00" ? "#15803d" : "#475569"}; font-weight: 500;">
            ${message}
          </div>
        `;
      }
    }

    // D. Dispatch Sticky Cart sync event
    window.dispatchEvent(
      new CustomEvent("bundlify:tier_changed", {
        detail: { totalPrice: discountedTotal },
      })
    );

    // Optional: Hide native quantity selectors from theme if deal forces single-item select
    const themeQtySelectors = document.querySelectorAll(".quantity, .product-form__quantity, [data-quantity-input]");
    themeQtySelectors.forEach((selector) => {
      selector.style.display = "none";
    });

    console.log(`Bundlify App Embed: Selected quantity sync ${activeTier.quantity} items for deal ${deal.name}`);
  }

  function updateUpsellProductProperties(isEnabled, productName, price) {
    const productForm = document.querySelector('form[action="/cart/add"]');
    if (!productForm) return;

    let upsellInput = productForm.querySelector('input[name="properties[_bundlify_upsell_product]"]');
    let upsellPriceInput = productForm.querySelector('input[name="properties[_bundlify_upsell_price]"]');

    if (isEnabled) {
      if (!upsellInput) {
        upsellInput = document.createElement("input");
        upsellInput.type = "hidden";
        upsellInput.name = "properties[_bundlify_upsell_product]";
        productForm.appendChild(upsellInput);
      }
      upsellInput.value = productName;

      if (!upsellPriceInput) {
        upsellPriceInput = document.createElement("input");
        upsellPriceInput.type = "hidden";
        upsellPriceInput.name = "properties[_bundlify_upsell_price]";
        productForm.appendChild(upsellPriceInput);
      }
      upsellPriceInput.value = String(price);
      console.log(`Bundlify App Embed: Checkbox upsell added: ${productName} ($${price})`);
    } else {
      if (upsellInput) upsellInput.remove();
      if (upsellPriceInput) upsellPriceInput.remove();
      console.log(`Bundlify App Embed: Checkbox upsell removed`);
    }
  }
})();
