import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import "../assets/app._index.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);

  // Fetch shop information from GraphQL
  const response = await admin.graphql(
    `#graphql
    query {
      shop {
        name
        email
        myshopifyDomain
      }
    }`
  );
  
  const responseJson = await response.json();
  const shopData = responseJson.data?.shop || { name: "Store", email: "", myshopifyDomain: "store" };
  
  // Extract owner name from email
  let ownerName = "Mitul";
  if (shopData.email) {
    const email = shopData.email.toLowerCase();
    if (email.includes("mitul")) {
      ownerName = "Mitul";
    } else {
      const emailPrefix = email.split("@")[0];
      const rawName = emailPrefix.split(".")[0].split("-")[0].replace(/[0-9]/g, '');
      ownerName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    }
  }

  // Extract clean store name
  let storeName = shopData.name;
  if (!storeName && shopData.myshopifyDomain) {
    const prefix = shopData.myshopifyDomain.split(".")[0];
    storeName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }

  const storeHandle = shopData.myshopifyDomain ? shopData.myshopifyDomain.split(".")[0] : "bundlify-ai-bundles-store";

  // Check if our App Embed is enabled on the storefront
  let isEmbedEnabled = false;
  try {
    const themes = await admin.rest.resources.Theme.all({ session });
    const mainTheme = themes.data.find((t: any) => t.role === "main");
    
    if (mainTheme) {
      const asset = await admin.rest.resources.Asset.find({
        session,
        theme_id: mainTheme.id,
        asset: { key: "config/settings_data.json" },
      });
      
      if (asset && asset.value) {
        const settings = JSON.parse(asset.value);
        const blocks = settings.current?.blocks || {};
        
        isEmbedEnabled = Object.values(blocks).some((block: any) => 
          block.type && 
          block.type.includes("77aea4b5141f35938a18a48b1f314e46") && 
          block.disabled === false
        );
      }
    }
  } catch (error) {
    console.error("Error checking theme app embed status:", error);
  }

  return {
    shopName: storeName || "Zivraa",
    ownerName: ownerName || "Mitul",
    shopDomain: session.shop,
    storeHandle: storeHandle,
    isEmbedEnabled: isEmbedEnabled,
  };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );
  const responseJson = await response.json();

  const product = responseJson.data!.productCreate!.product!;
  const variantId = product.variants.edges[0]!.node!.id!;

  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyReactRouterTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );

  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson!.data!.productCreate!.product,
    variant:
      variantResponseJson!.data!.productVariantsBulkUpdate!.productVariants,
  };
};

export default function Index() {
  const { shopName, ownerName, shopDomain, storeHandle, isEmbedEnabled } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  
  const fetcher = useFetcher<typeof action>();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.product?.id) {
      shopify.toast.show("Product created");
    }
  }, [fetcher.data?.product?.id, shopify]);

  // Accordion state
  const [step1Open, setStep1Open] = useState(!isEmbedEnabled);
  const [step2Open, setStep2Open] = useState(isEmbedEnabled);

  useEffect(() => {
    if (isEmbedEnabled) {
      shopify.toast.show("App Embed is Active! Next step: Create your first bundle.");
    }
  }, [isEmbedEnabled, shopify]);

  const handleReload = () => {
    shopify.toast.show("Verifying activation status...");
    window.location.reload();
  };

  return (
    <div className="dashboard-container">
      {/* Header Banner */}
      <div className="dashboard-header">
        <div>
          <h1 className="welcome-title">
            Welcome, <span>{ownerName}</span>!
          </h1>
          <p className="welcome-subtitle">
            Owner of <strong>{shopName}</strong>
            <span className={`status-dot ${isEmbedEnabled ? "active" : "inactive"}`}></span>
            App Embed: {isEmbedEnabled ? "Active" : "Inactive"}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <a
            className="btn-secondary"
            href={`https://admin.shopify.com/store/${storeHandle}/themes/current/editor?context=apps&activateAppId=77aea4b5141f35938a18a48b1f314e46/app-embed`}
            target="_blank"
            rel="noreferrer"
            style={{ display: "flex", alignItems: "center" }}
          >
            Customize Theme
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Total Sales</span>
            <span className="stat-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
          </div>
          <div className="stat-value">$12,482.50</div>
          <div className="stat-trend trend-up">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            +12.3% this month
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Extra AOV Revenue</span>
            <span className="stat-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </span>
          </div>
          <div className="stat-value">$3,820.00</div>
          <div className="stat-trend trend-up">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            +18.5% bundle sales
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-header">
            <span className="stat-label">Active Bundle Deals</span>
            <span className="stat-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </span>
          </div>
          <div className="stat-value">0</div>
          <div className="stat-trend trend-flat">No active deals yet</div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Left Column */}
        <div>
          {/* Setup Guide */}
          <div className="panel-card">
            <h2 className="card-title">Setup Guide</h2>
            <div className="setup-guide-progress">
              <div className="progress-header">
                <span>App Setup Progress</span>
                <span>{isEmbedEnabled ? "1 of 2" : "0 of 2"} steps completed</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: isEmbedEnabled ? "50%" : "0%" }}></div>
              </div>
            </div>

            {/* Step 1 */}
            <div className={`setup-step ${isEmbedEnabled ? "completed" : ""} ${step1Open ? "active" : ""}`}>
              <div className="setup-step-header" onClick={() => { setStep1Open(!step1Open); setStep2Open(isEmbedEnabled ? !step2Open : false); }}>
                <span className="step-number">{isEmbedEnabled ? "✓" : "1"}</span>
                <span className="step-title">
                  1. Activate Bundlify Embed on storefront {isEmbedEnabled ? "(Active)" : "(Inactive)"}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ transform: step1Open ? "rotate(180deg)" : "rotate(0)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {step1Open && (
                <div className="setup-step-content">
                  {isEmbedEnabled ? (
                    <>
                      <p style={{ margin: "0 0 12px 0", color: "#10b981", fontWeight: 500 }}>
                        ✓ Bundlify Embed is currently active on your storefront. Your bundle deals are live.
                      </p>
                      <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                        <a
                          className="btn-secondary"
                          href={`https://admin.shopify.com/store/${storeHandle}/themes/current/editor?context=apps&activateAppId=77aea4b5141f35938a18a48b1f314e46/app-embed`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Manage App Embed
                        </a>
                      </div>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 12px 0" }}>
                        Activate the widget by clicking the button below, turning it ON, and then clicking "Save" on the theme editor page.
                      </p>
                      <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                        <a
                          className="btn-primary"
                          href={`https://admin.shopify.com/store/${storeHandle}/themes/current/editor?context=apps&activateAppId=77aea4b5141f35938a18a48b1f314e46/app-embed`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                          Activate App Embed
                        </a>
                        <button className="btn-secondary" onClick={handleReload}>
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          I've Enabled It
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Step 2 */}
            <div className={`setup-step ${step2Open ? "active" : ""}`}>
              <div className="setup-step-header" onClick={() => { setStep2Open(!step2Open); setStep1Open(false); }}>
                <span className="step-number">2</span>
                <span className="step-title">2. Create your first bundle deal</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ transform: step2Open ? "rotate(180deg)" : "rotate(0)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {step2Open && (
                <div className="setup-step-content">
                  <p style={{ margin: "0 0 12px 0" }}>
                    Setup quantity discount tiers or product bundles for your items to grow AOV.
                  </p>
                  <button className="btn-secondary" onClick={() => shopify.toast.show("Create Bundle Deal Clicked")}>
                    Create Bundle Deal
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Video Tutorial Card */}
          <div className="video-card">
            <a
              className="video-thumbnail-container"
              href="https://youtu.be/rgZU5pDf6mw"
              target="_blank"
              rel="noreferrer"
            >
              <img
                src="https://img.youtube.com/vi/rgZU5pDf6mw/hqdefault.jpg"
                alt="Tutorial Video Thumbnail"
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  position: "absolute",
                  top: 0,
                  left: 0,
                }}
              />
              <div className="play-badge">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
              <div className="duration-badge">2:36</div>
            </a>
            <div className="video-info">
              <h3 className="video-title">Let's create your first bundle deal together</h3>
              <p className="video-desc">
                In this 2 minute video co-founder Mitul shows you how easy it is to create a bundle deal with Bundlify.
              </p>
              <a
                className="btn-secondary"
                style={{ padding: "6px 12px", fontSize: "12px", width: "max-content", display: "inline-flex", alignItems: "center" }}
                href="https://youtu.be/rgZU5pDf6mw"
                target="_blank"
                rel="noreferrer"
              >
                Watch Video
              </a>
            </div>
          </div>
        </div>

        {/* Right Column: Empty State */}
        <div>
          <div className="panel-card" style={{ height: "calc(100% - 28px)", minHeight: "350px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <div className="empty-deals-card">
              <div className="empty-deals-img-container">
                <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <h3 className="empty-deals-title">Your deals will show here</h3>
              <p className="empty-deals-desc">
                This is where you'll create bundle deals for different products and manage them.
              </p>
              <div className="empty-deals-action">
                <button className="btn-glow" onClick={() => shopify.toast.show("Create Bundle Deal Triggered")}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Create Bundle Deal
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
