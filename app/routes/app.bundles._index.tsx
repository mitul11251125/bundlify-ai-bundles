import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import { authenticate } from "../shopify.server";
import { getDealsByShop, deleteDeal, setDealStatus } from "../models/deal.server";
import { useAppBridge } from "@shopify/app-bridge-react";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const deals = await getDealsByShop(session.shop);
  return { deals };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const dealId = formData.get("dealId") as string;

  if (intent === "delete") {
    await deleteDeal(dealId, session.shop);
    return { ok: true, message: "Deal deleted successfully" };
  }

  if (intent === "toggle_status") {
    const currentStatus = formData.get("status") as string;
    const newStatus = currentStatus === "active" ? "paused" : "active";
    await setDealStatus(dealId, session.shop, newStatus);
    return { ok: true, message: `Deal status updated to ${newStatus}` };
  }

  return { ok: false };
};

export default function DealsList() {
  const { deals } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const shopify = useAppBridge();
  const fetcher = useFetcher();

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this deal? This will remove the widget from storefront.")) {
      const fd = new FormData();
      fd.append("intent", "delete");
      fd.append("dealId", id);
      fetcher.submit(fd, { method: "POST" });
      shopify.toast.show("Deal deleted");
    }
  };

  const handleToggleStatus = (id: string, currentStatus: string) => {
    const fd = new FormData();
    fd.append("intent", "toggle_status");
    fd.append("dealId", id);
    fd.append("status", currentStatus);
    fetcher.submit(fd, { method: "POST" });
    shopify.toast.show(currentStatus === "active" ? "Deal paused" : "Deal activated");
  };

  return (
    <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0, color: "#09090b" }}>Bundle Deals</h1>
          <p style={{ margin: "4px 0 0 0", color: "#71717a", fontSize: "14px" }}>Create and manage your storefront bundle widgets</p>
        </div>
        <button
          onClick={() => navigate("/app/create-deal")}
          style={{
            background: "#09090b",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "10px 16px",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}
        >
          <span>+</span> Create Deal
        </button>
      </div>

      {deals.length === 0 ? (
        <div style={{
          background: "#fff",
          border: "1px solid #e4e4e7",
          borderRadius: "12px",
          padding: "48px 24px",
          textAlign: "center",
          marginTop: "20px"
        }}>
          <div style={{ fontSize: "40px", marginBottom: "16px" }}>📦</div>
          <h3 style={{ fontSize: "18px", fontWeight: 600, margin: "0 0 8px 0" }}>No deals created yet</h3>
          <p style={{ color: "#71717a", fontSize: "14px", margin: "0 0 20px 0", maxWidth: "400px", marginLeft: "auto", marginRight: "auto" }}>
            Create discount tiers to offer volume breaks or buy-one-get-one promotions on your store.
          </p>
          <button
            onClick={() => navigate("/app/create-deal")}
            style={{
              background: "#09090b",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              padding: "10px 18px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Create Your First Deal
          </button>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #e4e4e7", borderRadius: "12px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "#fafafa", borderBottom: "1px solid #e4e4e7" }}>
                <th style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 600, color: "#52525b" }}>Deal Name</th>
                <th style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 600, color: "#52525b" }}>Target Type</th>
                <th style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 600, color: "#52525b" }}>Tiers Count</th>
                <th style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 600, color: "#52525b" }}>Status</th>
                <th style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 600, color: "#52525b" }}>Updated At</th>
                <th style={{ padding: "14px 16px", fontSize: "13px", fontWeight: 600, color: "#52525b", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal: any) => (
                <tr key={deal.id} style={{ borderBottom: "1px solid #e4e4e7" }}>
                  <td style={{ padding: "14px 16px", fontSize: "14px", fontWeight: 600 }}>
                    {deal.name}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "14px", color: "#52525b", textTransform: "capitalize" }}>
                    {deal.targetType === "all" ? "All Products" : deal.targetType}
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "14px", color: "#52525b" }}>
                    {deal.tiers.length} Tiers
                  </td>
                  <td style={{ padding: "14px 16px" }}>
                    <span style={{
                      display: "inline-flex",
                      alignItems: "center",
                      padding: "2px 8px",
                      borderRadius: "100px",
                      fontSize: "12px",
                      fontWeight: 600,
                      background: deal.status === "active" ? "#dcfce7" : deal.status === "paused" ? "#fef3c7" : "#f4f4f5",
                      color: deal.status === "active" ? "#166534" : deal.status === "paused" ? "#92400e" : "#52525b",
                      textTransform: "capitalize"
                    }}>
                      {deal.status}
                    </span>
                  </td>
                  <td style={{ padding: "14px 16px", fontSize: "14px", color: "#71717a" }}>
                    {new Date(deal.updatedAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: "14px 16px", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                      <button
                        onClick={() => handleToggleStatus(deal.id, deal.status)}
                        style={{
                          background: "#fff",
                          border: "1px solid #e4e4e7",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        {deal.status === "active" ? "Pause" : "Activate"}
                      </button>
                      <button
                        onClick={() => navigate(`/app/bundles/${deal.id}`)}
                        style={{
                          background: "#fff",
                          border: "1px solid #e4e4e7",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 500,
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(deal.id)}
                        style={{
                          background: "#fef2f2",
                          border: "1px solid #fee2e2",
                          borderRadius: "6px",
                          padding: "6px 12px",
                          fontSize: "12px",
                          fontWeight: 500,
                          color: "#ef4444",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
