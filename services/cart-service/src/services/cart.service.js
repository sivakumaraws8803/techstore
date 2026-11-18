import { pool } from "../config/database.js";
import { getActiveProduct } from "./products.client.js";
export async function initializeCartSchema() {
  await pool.query("CREATE TABLE IF NOT EXISTS public.cart_items (id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL, product_id BIGINT NOT NULL, product_name VARCHAR(150) NOT NULL, unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0), quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 99), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CONSTRAINT cart_items_user_product_unique UNIQUE (user_id, product_id))");
  await pool.query("CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id)");
}
function validId(value) { return /^\d{1,18}$/.test(String(value || "")); }
function fail(message, status) { const error = new Error(message); error.status = status; return error; }
function normalizeProduct(product) {
  const id = product?.id, name = String(product?.name || "").trim(), price = Number(product?.price);
  if (!validId(id) || !name || !Number.isFinite(price) || price < 0) throw fail("Product service returned invalid product data.", 502);
  return { id: String(id), name: name.slice(0, 150), price: price.toFixed(2) };
}
export async function getCart(userId) {
  const result = await pool.query("SELECT product_id, product_name, unit_price, quantity, (unit_price * quantity)::NUMERIC(12,2) AS line_total FROM public.cart_items WHERE user_id=$1 ORDER BY created_at DESC", [userId]);
  const items = result.rows.map(row => ({ productId: row.product_id, name: row.product_name, unitPrice: Number(row.unit_price), quantity: row.quantity, lineTotal: Number(row.line_total) }));
  return { items, itemCount: items.reduce((sum, item) => sum + item.quantity, 0), subtotal: Number(items.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2)) };
}
export async function addCartItem(userId, productId, quantity) {
  if (!validId(productId)) throw fail("Invalid product ID.", 400);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) throw fail("Quantity must be an integer between 1 and 99.", 400);
  const found = await getActiveProduct(productId);
  if (!found) throw fail("Product not found or inactive.", 404);
  const product = normalizeProduct(found);
  const result = await pool.query("INSERT INTO public.cart_items (user_id,product_id,product_name,unit_price,quantity) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id,product_id) DO UPDATE SET quantity=public.cart_items.quantity+EXCLUDED.quantity, product_name=EXCLUDED.product_name, unit_price=EXCLUDED.unit_price, updated_at=NOW() WHERE public.cart_items.quantity+EXCLUDED.quantity<=99 RETURNING id", [userId, product.id, product.name, product.price, quantity]);
  if (!result.rowCount) throw fail("Cart quantity cannot exceed 99 for one product.", 409);
  return getCart(userId);
}
export async function updateCartItem(userId, productId, quantity) {
  if (!validId(productId)) throw fail("Invalid product ID.", 400);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) throw fail("Quantity must be an integer between 1 and 99.", 400);
  const result = await pool.query("UPDATE public.cart_items SET quantity=$3,updated_at=NOW() WHERE user_id=$1 AND product_id=$2 RETURNING id", [userId, productId, quantity]);
  if (!result.rowCount) throw fail("Cart item not found.", 404);
  return getCart(userId);
}
export async function removeCartItem(userId, productId) {
  if (!validId(productId)) throw fail("Invalid product ID.", 400);
  const result = await pool.query("DELETE FROM public.cart_items WHERE user_id=$1 AND product_id=$2 RETURNING id", [userId, productId]);
  if (!result.rowCount) throw fail("Cart item not found.", 404);
  return getCart(userId);
}
export async function clearCart(userId) {
  await pool.query("DELETE FROM public.cart_items WHERE user_id=$1", [userId]);
  return getCart(userId);
}