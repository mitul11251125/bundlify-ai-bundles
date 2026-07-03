import { useEffect, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useFetcher, useLoaderData, useNavigate } from "react-router";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { getDealsByShop } from "../models/deal.server";
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
    const themeResponse = await admin.graphql(
      `#graphql
      query {
        themes(first: 10) {
          nodes {
            id
            role
            files(filenames: ["config/settings_data.json"]) {
              nodes {
                body {
                  ... on OnlineStoreThemeFileBodyText {
                    content
                  }
                }
              }
            }
          }
        }
      }`
    );
    const themeResponseJson = await themeResponse.json();
    const themesNodes = themeResponseJson.data?.themes?.nodes || [];
    const mainTheme = themesNodes.find((t: any) => t.role === "MAIN");

    if (mainTheme && mainTheme.files?.nodes?.[0]?.body?.content) {
      const content = mainTheme.files.nodes[0].body.content;
      // Strip both inline and multi-line comments from JSON
      const cleanJson = content.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1').trim();
      const settings = JSON.parse(cleanJson);
      const blocks = settings.current?.blocks || {};

      isEmbedEnabled = Object.values(blocks).some((block: any) => 
        block.type && 
        block.type.includes("app-embed") && 
        (
          block.type.includes("bundlify") || 
          block.type.includes("77aea4b5141f35938a18a48b1f314e46") || 
          (process.env.SHOPIFY_API_KEY && block.type.includes(process.env.SHOPIFY_API_KEY))
        ) && 
        block.disabled === false
      );
    }
  } catch (error) {
    console.error("Error checking theme app embed status:", error);
  }

  // Fetch created deals
  const deals = await getDealsByShop(session.shop);

  return {
    shopName: storeName || "Zivraa",
    ownerName: ownerName || "Mitul",
    shopDomain: session.shop,
    storeHandle: storeHandle,
    isEmbedEnabled: isEmbedEnabled,
    deals: deals,
  };
};


export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "verify_embed") {
    let isEmbedEnabled = false;
    try {
      const themeResponse = await admin.graphql(
        `#graphql
        query {
          themes(first: 10) {
            nodes {
              id
              role
              files(filenames: ["config/settings_data.json"]) {
                nodes {
                  body {
                    ... on OnlineStoreThemeFileBodyText {
                      content
                    }
                  }
                }
              }
            }
          }
        }`
      );
      const themeResponseJson = await themeResponse.json();
      const themesNodes = themeResponseJson.data?.themes?.nodes || [];
      const mainTheme = themesNodes.find((t: any) => t.role === "MAIN");

      if (mainTheme && mainTheme.files?.nodes?.[0]?.body?.content) {
        const content = mainTheme.files.nodes[0].body.content;
        // Strip both inline and multi-line comments from JSON
        const cleanJson = content.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1').trim();
        const settings = JSON.parse(cleanJson);
        const blocks = settings.current?.blocks || {};

        isEmbedEnabled = Object.values(blocks).some((block: any) => 
          block.type && 
          block.type.includes("app-embed") && 
          (
            block.type.includes("bundlify") || 
            block.type.includes("77aea4b5141f35938a18a48b1f314e46") || 
            (process.env.SHOPIFY_API_KEY && block.type.includes(process.env.SHOPIFY_API_KEY))
          ) && 
          block.disabled === false
        );
      }
    } catch (error) {
      console.error("Error checking theme app embed status in action:", error);
    }
    return { isEmbedEnabled, actionType: "verify_embed" };
  }

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
  const { shopName, ownerName, shopDomain, storeHandle, isEmbedEnabled, deals } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();
  const navigate = useNavigate();
  
  const fetcher = useFetcher<typeof action>();
  const verifyFetcher = useFetcher<typeof action>();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";

  useEffect(() => {
    if (fetcher.data?.product?.id) {
      shopify.toast.show("Product created");
    }
  }, [fetcher.data?.product?.id, shopify]);

  // Local state to manage the dynamic embed state and warnings
  const [embedActive, setEmbedActive] = useState(isEmbedEnabled);
  const [verificationError, setVerificationError] = useState(false);

  // Accordion state
  const [step1Open, setStep1Open] = useState(!isEmbedEnabled);
  const [step2Open, setStep2Open] = useState(isEmbedEnabled);

  useEffect(() => {
    if (verifyFetcher.data && verifyFetcher.data.actionType === "verify_embed") {
      const active = verifyFetcher.data.isEmbedEnabled;
      if (active) {
        setEmbedActive(true);
        setStep1Open(false);
        setStep2Open(true);
        setVerificationError(false);
        shopify.toast.show("App Embed activated successfully!");
      } else {
        setVerificationError(true);
        shopify.toast.show("Verification failed. Please ensure the toggle is ON and Save.", { isError: true });
      }
    }
  }, [verifyFetcher.data, shopify]);

  const handleVerify = () => {
    const formData = new FormData();
    formData.append("actionType", "verify_embed");
    verifyFetcher.submit(formData, { method: "POST" });
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
            <span className={`status-dot ${embedActive ? "active" : "inactive"}`}></span>
            App Embed: {embedActive ? "Active" : "Inactive"}
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
                <span>{embedActive ? "1 of 2" : "0 of 2"} steps completed</span>
              </div>
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: embedActive ? "50%" : "0%" }}></div>
              </div>
            </div>

            {/* Step 1 */}
            <div className={`setup-step ${embedActive ? "completed" : ""} ${step1Open ? "active" : ""}`}>
              <div className="setup-step-header" onClick={() => { setStep1Open(!step1Open); setStep2Open(embedActive ? !step2Open : false); }}>
                <span className="step-number">{embedActive ? "✓" : "1"}</span>
                <span className="step-title">
                  1. Activate Bundlify Embed on storefront {embedActive ? "(Active)" : "(Inactive)"}
                </span>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ transform: step1Open ? "rotate(180deg)" : "rotate(0)" }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              {step1Open && (
                <div className="setup-step-content">
                  {verificationError && (
                    <div style={{
                      background: "#fef2f2",
                      border: "1px solid #fee2e2",
                      borderRadius: "6px",
                      padding: "10px 12px",
                      color: "#991b1b",
                      fontSize: "12.5px",
                      marginBottom: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px"
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>Please turn ON the "Bundlify Embed" switch in the theme editor and click <strong>Save</strong> before verifying!</span>
                    </div>
                  )}
                  {embedActive ? (
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
                        <button 
                          className="btn-secondary" 
                          onClick={handleVerify}
                          disabled={verifyFetcher.state !== "idle"}
                        >
                          {verifyFetcher.state !== "idle" ? (
                            <span>Verifying...</span>
                          ) : (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              I've Enabled It
                            </>
                          )}
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
                  <button className="btn-secondary" onClick={() => navigate("/app/create-deal")}>
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

        {/* Right Column: Active Deals / Empty State */}
        <div>
          <div className="panel-card" style={{ height: "calc(100% - 28px)", minHeight: "350px", display: "flex", flexDirection: "column", justifyContent: deals.length > 0 ? "flex-start" : "center" }}>
            {deals.length > 0 ? (
              <div style={{ width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 className="card-title" style={{ margin: 0 }}>Active Bundle Deals</h3>
                  <button 
                    className="btn-secondary" 
                    onClick={() => navigate("/app/bundles")}
                    style={{ padding: "4px 8px", fontSize: "12px" }}
                  >
                    View All
                  </button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {deals.slice(0, 3).map((deal: any) => (
                    <div 
                      key={deal.id} 
                      onClick={() => navigate(`/app/bundles/${deal.id}`)}
                      style={{
                        padding: "12px",
                        border: "1px solid #e4e4e7",
                        borderRadius: "8px",
                        background: "#fafafa",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center"
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "13.5px", color: "#09090b" }}>{deal.name}</div>
                        <div style={{ fontSize: "11px", color: "#71717a", marginTop: "2px" }}>
                          {deal.targetType === "all" ? "All products" : "Targeted products"} • {deal.tiers.length} Tiers
                        </div>
                      </div>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: "100px",
                        fontSize: "11px",
                        fontWeight: 600,
                        background: deal.status === "active" ? "#dcfce7" : "#f4f4f5",
                        color: deal.status === "active" ? "#166534" : "#52525b",
                        textTransform: "capitalize"
                      }}>
                        {deal.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
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
                  <button className="btn-glow" onClick={() => navigate("/app/create-deal")}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Create Bundle Deal
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
