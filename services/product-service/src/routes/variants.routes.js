import { Router } from "express";
import { pool } from "../config/database.js";

const router = Router();
const owner = (req, res, next) => {
  if (!req.session?.user) return res.status(401).json({ error: "Authentication required." });
  if (req.session.user.role !== "owner" && req.session.user.role !== "product_manager")
    return res.status(403).json({ error: "You do not have permission to manage variants." });
  next();
};
const validId = value => /^\d+$/.test(String(value)) && Number(value) > 0 && Number.isSafeInteger(Number(value));
async function syncProductSummary(productId) {
  await pool.query("UPDATE products SET stock=COALESCE((SELECT SUM(stock) FROM product_variants WHERE product_id=$1 AND is_active=TRUE),0), price=COALESCE((SELECT MIN(price) FROM product_variants WHERE product_id=$1 AND is_active=TRUE),price), updated_at=NOW() WHERE id=$1", [productId]);
}
const clean = (body = {}) => {
  const sku = String(body.sku || "").trim();
  const name = String(body.name || "").trim();
  const price = Number(body.price);
  const stock = Number(body.stock);
  const attributes = body.attributes && typeof body.attributes === "object" && !Array.isArray(body.attributes) ? body.attributes : {};
  if (!sku || sku.length > 80) throw Object.assign(new Error("SKU is required (maximum 80 characters)."), { status: 400 });
  if (!name || name.length > 120) throw Object.assign(new Error("Variant name is required (maximum 120 characters)."), { status: 400 });
  if (!Number.isFinite(price) || price < 0) throw Object.assign(new Error("Enter a valid non-negative price."), { status: 400 });
  if (!Number.isSafeInteger(stock) || stock < 0) throw Object.assign(new Error("Stock must be a non-negative whole number."), { status: 400 });
  const imageUrl = body.image_url == null ? null : String(body.image_url).trim();
  return { sku, name, price, stock, attributes, imageUrl };
};

router.get("/product/:productId", async (req, res, next) => {
  try {
    if (!validId(req.params.productId)) return res.status(400).json({ error: "Invalid product ID." });
    const result = await pool.query(
      `SELECT v.id, v.product_id, v.sku, v.name, v.attributes, v.price, v.stock, v.image_url
       FROM product_variants v JOIN products p ON p.id=v.product_id
       WHERE v.product_id=$1 AND v.is_active=TRUE AND p.is_active=TRUE
       ORDER BY v.id`, [req.params.productId]);
    res.set("Cache-Control", "no-store");
    res.json({ variants: result.rows });
  } catch (error) { next(error); }
});

router.get("/admin/product/:productId", owner, async (req, res, next) => {
  try {
    if (!validId(req.params.productId)) return res.status(400).json({ error: "Invalid product ID." });
    const result = await pool.query(
      "SELECT id, product_id, sku, name, attributes, price, stock, image_url, is_active FROM product_variants WHERE product_id=$1 ORDER BY id",
      [req.params.productId]);
    res.json({ variants: result.rows });
  } catch (error) { next(error); }
});

router.post("/product/:productId", owner, async (req, res, next) => {
  try {
    if (!validId(req.params.productId)) return res.status(400).json({ error: "Invalid product ID." });
    const v = clean(req.body);
    const result = await pool.query(
      `INSERT INTO product_variants(product_id,sku,name,attributes,price,stock,image_url)
       SELECT id,$2,$3,$4::jsonb,$5,$6,$7 FROM products WHERE id=$1 AND is_active=TRUE
       RETURNING id,product_id,sku,name,attributes,price,stock,image_url,is_active`,
      [req.params.productId,v.sku,v.name,JSON.stringify(v.attributes),v.price,v.stock,v.imageUrl]);
    if (!result.rowCount) return res.status(404).json({ error: "Active product not found." });
    await syncProductSummary(req.params.productId);
    res.status(201).json({ variant: result.rows[0] });
  } catch (error) { next(error); }
});

router.put("/:id", owner, async (req, res, next) => {
  try {
    if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid variant ID." });
    const v = clean(req.body);
    const result = await pool.query(
      `UPDATE product_variants SET sku=$1,name=$2,attributes=$3::jsonb,price=$4,stock=$5,image_url=$6,updated_at=NOW()
       WHERE id=$7 RETURNING id,product_id,sku,name,attributes,price,stock,image_url,is_active`,
      [v.sku,v.name,JSON.stringify(v.attributes),v.price,v.stock,v.imageUrl,req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Variant not found." });
    await syncProductSummary(result.rows[0].product_id);
    res.json({ variant: result.rows[0] });
  } catch (error) { next(error); }
});

router.patch("/:id/status", owner, async (req, res, next) => {
  try {
    if (!validId(req.params.id) || typeof req.body?.is_active !== "boolean")
      return res.status(400).json({ error: "A valid variant ID and is_active boolean are required." });
    const result = await pool.query(
      "UPDATE product_variants SET is_active=$1,updated_at=NOW() WHERE id=$2 RETURNING id,product_id,is_active",
      [req.body.is_active,req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: "Variant not found." });
    res.json({ variant: result.rows[0] });
  } catch (error) { next(error); }
});

export default router;
