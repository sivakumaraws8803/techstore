const BASE = (process.env.PRODUCT_SERVICE_URL || "http://127.0.0.1:3002").replace(/\/$/, "");
export async function getActiveProduct(productId) {
  const response = await fetch(BASE + "/api/products/" + encodeURIComponent(productId), { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(4000) });
  if (response.status === 404) return null;
  if (!response.ok) { const error = new Error("Product service is temporarily unavailable."); error.status = 503; throw error; }
  const data = await response.json();
  return data.product || null;
}