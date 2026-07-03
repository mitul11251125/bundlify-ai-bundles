import { useState } from "react";
import { useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import "../assets/app.create-deal.css";

type ColorTheme = "black" | "red" | "orange" | "green" | "blue" | "purple" | "pink";

export default function CreateDeal() {
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const [activeTheme, setActiveTheme] = useState<ColorTheme>("black");

  // Interaction states for cards
  const [card1Selected, setCard1Selected] = useState<number>(1); // Duo selected
  const [card2Selected, setCard2Selected] = useState<number>(0); // Buy 1 Get 1 selected
  const [card3Selected, setCard3Selected] = useState<number>(1); // 2 pack selected
  const [card4Selected, setCard4Selected] = useState<number>(1); // Complete selected
  const [card5Selected, setCard5Selected] = useState<number>(0); // Buy 1 Get 1 selected
  const [card5Subscribed, setCard5Subscribed] = useState<boolean>(true); // Subscribe Checked
  const [card6Selected, setCard6Selected] = useState<number>(1); // 2 pack selected

  const handleChooseTemplate = (templateName: string) => {
    shopify.toast.show(`Template Selected: ${templateName}`);
    setTimeout(() => {
      navigate("/app");
    }, 1500);
  };

  const colorsList: { theme: ColorTheme; hex: string }[] = [
    { theme: "black", hex: "#111" },
    { theme: "red", hex: "#e02424" },
    { theme: "orange", hex: "#ff5a1f" },
    { theme: "green", hex: "#0e9f6e" },
    { theme: "blue", hex: "#1c64f2" },
    { theme: "purple", hex: "#7e3af2" },
    { theme: "pink", hex: "#ec4899" },
  ];

  return (
    <div className={`create-deal-container theme-${activeTheme}`}>
      {/* Header section */}
      <div className="create-deal-header">
        <div className="header-left">
          <button className="back-button" onClick={() => navigate("/app")}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="header-title-container">
            <h1>Choose a discount type</h1>
            <p>You can fully customize it later.</p>
          </div>
        </div>

        {/* Dynamic Color Switcher */}
        <div className="theme-switcher">
          <span className="theme-label">Color theme</span>
          <div className="theme-dots">
            {colorsList.map((c) => (
              <button
                key={c.theme}
                className={`color-dot ${activeTheme === c.theme ? "active" : ""}`}
                style={{ backgroundColor: c.hex }}
                onClick={() => setActiveTheme(c.theme)}
                title={`Switch theme to ${c.theme}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Grid of templates */}
      <div className="templates-grid">
        {/* Card 1: Quantity breaks for same product */}
        <div className="template-card">
          <div className="preview-sandbox">
            <div className="preview-widget">
              {/* Single Option */}
              <div 
                className={`widget-row ${card1Selected === 0 ? "selected" : ""}`}
                onClick={() => setCard1Selected(0)}
              >
                <div className="row-main">
                  <div className="row-left">
                    <span className="custom-radio">
                      <span className="custom-radio-inner" />
                    </span>
                    <span className="tier-label">Single</span>
                  </div>
                  <div className="row-right">
                    <span className="price-current">$14.99</span>
                    <span className="price-old">$19.99</span>
                  </div>
                </div>
                <div className="sub-text" style={{ paddingLeft: "24px" }}>Standard price</div>
              </div>

              {/* Duo Option */}
              <div 
                className={`widget-row ${card1Selected === 1 ? "selected" : ""}`}
                onClick={() => setCard1Selected(1)}
              >
                {/* Most Popular badge */}
                <div className={`badge-star badge-star-${activeTheme}`}>
                  <div className="star-container">
                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192z" />
                    </svg>
                    Most Popular
                  </div>
                </div>

                <div className="row-main">
                  <div className="row-left">
                    <span className="custom-radio">
                      <span className="custom-radio-inner" />
                    </span>
                    <span className="tier-label">Duo</span>
                    <span className="badge-save">SAVE $14.48</span>
                  </div>
                  <div className="row-right">
                    <span className="price-current">$25.50</span>
                    <span className="price-old">$39.98</span>
                  </div>
                </div>
                <div className="sub-text" style={{ paddingLeft: "24px" }}>You save 36%</div>

                {card1Selected === 1 && (
                  <div className="variant-swatches">
                    <div className="swatch-row">
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <div className="swatch-image-placeholder" />
                        <span>White</span>
                      </div>
                      <select className="swatch-dropdown" defaultValue="White">
                        <option>White</option>
                        <option>Black</option>
                      </select>
                    </div>
                    <div className="swatch-row">
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <div className="swatch-image-placeholder" />
                        <span>White</span>
                      </div>
                      <select className="swatch-dropdown" defaultValue="White">
                        <option>White</option>
                        <option>Black</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="card-footer">
            <h3 className="card-title">Quantity breaks for the same product</h3>
            <button className="btn-choose" onClick={() => handleChooseTemplate("Quantity breaks for the same product")}>
              Choose
            </button>
          </div>
        </div>

        {/* Card 2: Buy X, get Y deal */}
        <div className="template-card">
          <div className="preview-sandbox">
            <div className="preview-widget">
              {/* Buy 1 Get 1 */}
              <div 
                className={`widget-row ${card2Selected === 0 ? "selected" : ""}`}
                onClick={() => setCard2Selected(0)}
              >
                <div className="row-main">
                  <div className="row-left">
                    <span className="custom-radio">
                      <span className="custom-radio-inner" />
                    </span>
                    <span className="tier-label">Buy 1, get 1 free</span>
                    <span className="badge-save">SAVE 63%</span>
                  </div>
                  <div className="row-right">
                    <span className="price-current">$14.99</span>
                    <span className="price-old">$39.98</span>
                  </div>
                </div>
              </div>

              {/* Buy 2 Get 3 */}
              <div 
                className={`widget-row ${card2Selected === 1 ? "selected" : ""}`}
                onClick={() => setCard2Selected(1)}
              >
                <div className="row-main">
                  <div className="row-left">
                    <span className="custom-radio">
                      <span className="custom-radio-inner" />
                    </span>
                    <span className="tier-label">Buy 2, get 3 free</span>
                    <span className="badge-save">SAVE 70%</span>
                  </div>
                  <div className="row-right">
                    <span className="price-current">$29.98</span>
                    <span className="price-old">$99.95</span>
                  </div>
                </div>
              </div>

              {/* Buy 3 Get 6 */}
              <div 
                className={`widget-row ${card2Selected === 2 ? "selected" : ""}`}
                onClick={() => setCard2Selected(2)}
              >
                <div className="row-main">
                  <div className="row-left">
                    <span className="custom-radio">
                      <span className="custom-radio-inner" />
                    </span>
                    <span className="tier-label">Buy 3, get 6 free</span>
                    <span className="badge-save">SAVE 75%</span>
                  </div>
                  <div className="row-right">
                    <span className="price-current">$44.97</span>
                    <span className="price-old">$179.91</span>
                  </div>
                </div>
              </div>

              <div className="gift-footer-text">
                + FREE special gift!
              </div>
            </div>
          </div>
          <div className="card-footer">
            <h3 className="card-title">Buy X, get Y (BXGY) deal</h3>
            <button className="btn-choose" onClick={() => handleChooseTemplate("Buy X, get Y (BXGY) deal")}>
              Choose
            </button>
          </div>
        </div>

        {/* Card 3: Quantity breaks for different products */}
        <div className="template-card">
          <div className="preview-sandbox">
            <div className="preview-widget">
              {/* 1 pack */}
              <div 
                className={`widget-row ${card3Selected === 0 ? "selected" : ""}`}
                onClick={() => setCard3Selected(0)}
              >
                <div className="row-main">
                  <div className="row-left">
                    <span className="custom-radio">
                      <span className="custom-radio-inner" />
                    </span>
                    <span className="tier-label">1 pack</span>
                  </div>
                  <div className="row-right">
                    <span className="price-current">$14.99</span>
                    <span className="price-old">$19.99</span>
                  </div>
                </div>
                <div className="sub-text" style={{ paddingLeft: "24px" }}>Standard price</div>
              </div>

              {/* 2 pack */}
              <div 
                className={`widget-row ${card3Selected === 1 ? "selected" : ""}`}
                onClick={() => setCard3Selected(1)}
              >
                <div className={`badge-star badge-star-${activeTheme}`}>
                  <div className="star-container">MOST POPULAR</div>
                </div>

                <div className="row-main">
                  <div className="row-left">
                    <span className="custom-radio">
                      <span className="custom-radio-inner" />
                    </span>
                    <span className="tier-label">2 pack</span>
                    <span className="badge-save" style={{ background: "#ebf5ff", color: "#1c64f2" }}>You save $14.48</span>
                  </div>
                  <div className="row-right">
                    <span className="price-current">$25.50</span>
                    <span className="price-old">$39.98</span>
                  </div>
                </div>

                {card3Selected === 1 && (
                  <div className="variant-swatches">
                    <div className="swatch-row">
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <div className="swatch-image-placeholder" />
                        <span>Classic Ceramic Mug</span>
                      </div>
                      <select className="swatch-dropdown" defaultValue="White">
                        <option>White</option>
                        <option>Black</option>
                      </select>
                    </div>
                    <button className="btn-add-product" onClick={(e) => { e.stopPropagation(); }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                      Choose
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="card-footer">
            <h3 className="card-title">Quantity breaks for different products</h3>
            <button className="btn-choose" onClick={() => handleChooseTemplate("Quantity breaks for different products")}>
              Choose
            </button>
          </div>
        </div>

        {/* Card 4: Complete the bundle */}
        <div className="template-card">
          <div className="preview-sandbox">
            <div className="preview-widget">
              {/* Product 1 */}
              <div 
                className={`widget-row ${card4Selected === 0 ? "selected" : ""}`}
                onClick={() => setCard4Selected(0)}
              >
                <div className="row-main">
                  <div className="row-left">
                    <span className="custom-radio">
                      <span className="custom-radio-inner" />
                    </span>
                    <span className="tier-label">Classic Ceramic Mug</span>
                  </div>
                  <div className="row-right">
                    <span className="price-current">$14.99</span>
                    <span className="price-old">$19.99</span>
                  </div>
                </div>
                <div className="sub-text" style={{ paddingLeft: "24px" }}>Standard price</div>
              </div>

              {/* Duo Product Bundle */}
              <div 
                className={`widget-row ${card4Selected === 1 ? "selected" : ""}`}
                onClick={() => setCard4Selected(1)}
              >
                <div className="row-main">
                  <div className="row-left">
                    <span className="custom-radio">
                      <span className="custom-radio-inner" />
                    </span>
                    <span className="tier-label">Complete the bundle</span>
                    <span className="badge-save">Save $19.98!</span>
                  </div>
                  <div className="row-right">
                    <span className="price-current">$28.00</span>
                    <span className="price-old">$47.98</span>
                  </div>
                </div>

                {card4Selected === 1 && (
                  <div className="bundle-split-container">
                    <div className="bundle-item">
                      <div className="bundle-item-img" />
                      <span className="bundle-item-title">Classic Ceramic Mug</span>
                      <span className="bundle-item-price">$12.00 <span style={{ textDecoration: "line-through", fontSize: "8px" }}>$19.99</span></span>
                      <select className="swatch-dropdown" style={{ marginTop: "4px" }} defaultValue="White">
                        <option>White</option>
                        <option>Black</option>
                      </select>
                    </div>
                    <span className="bundle-plus">+</span>
                    <div className="bundle-item">
                      <div className="bundle-item-img" style={{ background: "#4a4a4a" }} />
                      <span className="bundle-item-title">Classic Baseball Cap</span>
                      <span className="bundle-item-price">$16.00 <span style={{ textDecoration: "line-through", fontSize: "8px" }}>$27.99</span></span>
                      <select className="swatch-dropdown" style={{ marginTop: "4px" }} defaultValue="Black">
                        <option>Black</option>
                        <option>Blue</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="card-footer">
            <h3 className="card-title">Complete the bundle</h3>
            <button className="btn-choose" onClick={() => handleChooseTemplate("Complete the bundle")}>
              Choose
            </button>
          </div>
        </div>

        {/* Card 5: Subscription */}
        <div className="template-card">
          <div className="preview-sandbox">
            <div className="preview-widget">
              {/* Buy 1 Get 1 */}
              <div 
                className={`widget-row ${card5Selected === 0 ? "selected" : ""}`}
                onClick={() => setCard5Selected(0)}
              >
                <div className="row-main">
                  <div className="row-left">
                    <span className="custom-radio">
                      <span className="custom-radio-inner" />
                    </span>
                    <span className="tier-label">Buy 1, get 1 free</span>
                    <span className="badge-save">SAVE 70%</span>
                  </div>
                  <div className="row-right">
                    <span className="price-current">$11.99</span>
                    <span className="price-old">$39.98</span>
                  </div>
                </div>
              </div>

              {/* Buy 2 Get 3 */}
              <div 
                className={`widget-row ${card5Selected === 1 ? "selected" : ""}`}
                onClick={() => setCard5Selected(1)}
              >
                <div className="row-main">
                  <div className="row-left">
                    <span className="custom-radio">
                      <span className="custom-radio-inner" />
                    </span>
                    <span className="tier-label">Buy 2, get 3 free</span>
                    <span className="badge-save">SAVE 76%</span>
                  </div>
                  <div className="row-right">
                    <span className="price-current">$23.98</span>
                    <span className="price-old">$99.95</span>
                  </div>
                </div>
              </div>

              {/* Buy 3 Get 6 */}
              <div 
                className={`widget-row ${card5Selected === 2 ? "selected" : ""}`}
                onClick={() => setCard5Selected(2)}
              >
                <div className="row-main">
                  <div className="row-left">
                    <span className="custom-radio">
                      <span className="custom-radio-inner" />
                    </span>
                    <span className="tier-label">Buy 3, get 6 free</span>
                    <span className="badge-save">SAVE 80%</span>
                  </div>
                  <div className="row-right">
                    <span className="price-current">$35.97</span>
                    <span className="price-old">$179.91</span>
                  </div>
                </div>
              </div>

              <div className="gift-footer-text">
                + FREE special gift!
              </div>

              {/* Subscription Option Box */}
              <div className="subscription-container" onClick={() => setCard5Subscribed(!card5Subscribed)}>
                <div className="subscription-checkbox-container">
                  <input
                    type="checkbox"
                    checked={card5Subscribed}
                    onChange={() => {}} // handled by click on container
                    style={{ cursor: "pointer" }}
                  />
                </div>
                <div>
                  <div className="sub-title">Subscribe & Save 20%</div>
                  <div className="sub-desc">Zero Commitment, Cancel Anytime</div>
                </div>
              </div>
            </div>
          </div>
          <div className="card-footer">
            <h3 className="card-title">Subscription</h3>
            <button className="btn-choose" onClick={() => handleChooseTemplate("Subscription")}>
              Choose
            </button>
          </div>
        </div>

        {/* Card 6: Progressive gifts */}
        <div className="template-card">
          <div className="preview-sandbox">
            <div className="preview-widget">
              {/* Tiers List */}
              <div 
                className={`widget-row ${card6Selected === 0 ? "selected" : ""}`}
                onClick={() => setCard6Selected(0)}
              >
                <div className="row-main">
                  <div className="row-left">
                    <span className="custom-radio">
                      <span className="custom-radio-inner" />
                    </span>
                    <span className="tier-label">1 pack</span>
                  </div>
                  <div className="row-right">
                    <span className="price-current">$14.99</span>
                    <span className="price-old">$19.99</span>
                  </div>
                </div>
              </div>

              <div 
                className={`widget-row ${card6Selected === 1 ? "selected" : ""}`}
                onClick={() => setCard6Selected(1)}
              >
                <div className="row-main">
                  <div className="row-left">
                    <span className="custom-radio">
                      <span className="custom-radio-inner" />
                    </span>
                    <span className="tier-label">2 pack</span>
                    <span className="badge-save">SAVE 36%</span>
                  </div>
                  <div className="row-right">
                    <span className="price-current">$25.50</span>
                    <span className="price-old">$39.98</span>
                  </div>
                </div>
              </div>

              <div 
                className={`widget-row ${card6Selected === 2 ? "selected" : ""}`}
                onClick={() => setCard6Selected(2)}
              >
                <div className="row-main">
                  <div className="row-left">
                    <span className="custom-radio">
                      <span className="custom-radio-inner" />
                    </span>
                    <span className="tier-label">3 pack</span>
                    <span className="badge-save">SAVE 36%</span>
                  </div>
                  <div className="row-right">
                    <span className="price-current">$38.25</span>
                    <span className="price-old">$59.97</span>
                  </div>
                </div>
              </div>

              {/* Unlock Progressive Gifts section */}
              <div className="gifts-header-container">
                <div className="gifts-header-title">
                  <span>🎁</span> Unlock Free gifts with your order
                </div>
                <div className="gifts-progress-cards">
                  {/* Gift 1: Free Shipping (Active for any pack selection >= 0) */}
                  <div className="gift-progress-card active">
                    <span className="gift-card-badge">Free</span>
                    <span className="gift-icon-container">🚚</span>
                    <span className="gift-name">Free shipping</span>
                  </div>

                  {/* Gift 2: Baseball cap (Active for selected >= 1) */}
                  <div className={`gift-progress-card ${card6Selected >= 1 ? "active" : "locked"}`}>
                    <span className="gift-card-badge">{card6Selected >= 1 ? "Free" : "$19.99"}</span>
                    <span className="gift-icon-container">🧢</span>
                    <span className="gift-name" style={{ fontSize: "7px" }}>Classic Baseball Cap</span>
                    <select className="swatch-dropdown" style={{ marginTop: "2px", transform: "scale(0.85)", transformOrigin: "left" }} defaultValue="Bl...">
                      <option>Bl...</option>
                    </select>
                  </div>

                  {/* Gift 3: Locked (Requires tier 3, which is 3 pack) */}
                  <div className={`gift-progress-card ${card6Selected >= 2 ? "active" : "locked"}`}>
                    <span className="gift-card-badge">{card6Selected >= 2 ? "Free" : "$49.99"}</span>
                    <span className="gift-icon-container">{card6Selected >= 2 ? "🎁" : "🔒"}</span>
                    <span className="gift-name">{card6Selected >= 2 ? "Special Gift" : "Locked"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="card-footer">
            <h3 className="card-title">Progressive gifts</h3>
            <button className="btn-choose" onClick={() => handleChooseTemplate("Progressive gifts")}>
              Choose
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
