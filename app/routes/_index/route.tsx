import type { LoaderFunctionArgs } from "react-router";
import { redirect, Form, useLoaderData } from "react-router";
import { login } from "../../shopify.server";
import styles from "./styles.module.css";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  if (url.searchParams.get("shop")) {
    throw redirect(`/app?${url.searchParams.toString()}`);
  }

  return { showForm: Boolean(login) };
};

export default function App() {
  const { showForm } = useLoaderData<typeof loader>();

  return (
    <div className={styles.index}>
      {/* Header section */}
      <header className={styles.header}>
        <div className={styles.logoContainer}>
          <img src="/logo.png" alt="Bundlify Logo" className={styles.logo} />
          <span className={styles.logoText}>Bundlify</span>
          <span className={styles.badge}>AI Powered</span>
        </div>
      </header>

      {/* Main landing container */}
      <main className={styles.container}>
        <div className={styles.hero}>
          <h1 className={styles.heading}>
            Boost Your Store's AOV With Smart AI Bundles
          </h1>
          <p className={styles.tagline}>
            Bundlify automatically creates high-converting product bundles, quantity discount tiers, and volume discounts using smart AI recommendations.
          </p>
        </div>

        {/* Installation and Login portal */}
        {showForm && (
          <div className={styles.formContainer}>
            <h2 className={styles.formTitle}>Install or Access Your Dashboard</h2>
            <Form className={styles.form} method="post" action="/auth/login">
              <div className={styles.inputGroup}>
                <span className={styles.labelSpan}>Enter Your Shopify Store URL</span>
                <input 
                  className={styles.input} 
                  type="text" 
                  name="shop" 
                  placeholder="my-store.myshopify.com"
                  required
                />
                <span className={styles.hint}>e.g: quick-bundle-shop.myshopify.com</span>
              </div>
              <button className={styles.button} type="submit">
                Install & Configure
              </button>
            </Form>
          </div>
        )}

        {/* Features section */}
        <h3 className={styles.featuresTitle}>Why Top Merchants Choose Bundlify</h3>
        <div className={styles.grid}>
          {/* Card 1 */}
          <div className={styles.card}>
            <div className={styles.iconWrapper}>🧠</div>
            <h4 className={styles.cardTitle}>AI Smart Recommendations</h4>
            <p className={styles.cardText}>
              Automatically analyzes customer purchase history to suggest and dynamically display the highest-converting product pairings.
            </p>
          </div>

          {/* Card 2 */}
          <div className={styles.card}>
            <div className={styles.iconWrapper}>📦</div>
            <h4 className={styles.cardTitle}>Multi-Tier Quantity Discounts</h4>
            <p className={styles.cardText}>
              Encourage bulk buying with beautiful volume tiers, BOGO offers, and custom mix-and-match packages in one-click.
            </p>
          </div>

          {/* Card 3 */}
          <div className={styles.card}>
            <div className={styles.iconWrapper}>🎨</div>
            <h4 className={styles.cardTitle}>Customizable Premium UI</h4>
            <p className={styles.cardText}>
              Choose from stunning pre-built templates that blend natively into your Shopify theme with no code required.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          &copy; {new Date().getFullYear()} Bundlify AI. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
