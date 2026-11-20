import { Router } from "express";
import { pool } from "../config/database.js";

const router = Router();

function requireOwner(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: "Authentication required." });
  if (req.session.user.role !== "owner") return res.status(403).json({ error: "Owner access required." });
  next();
}
function cleanName(value) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 50) {
    const error = new Error("Category name is required (maximum 50 characters).");
    error.status = 400;
    throw error;
  }
  return value.trim();
}
function slugify(value) {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

router.get("/", requireOwner, async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT c.id,c.name,c.slug,c.description,c.is_active,c.created_at,c.updated_at,COUNT(p.id)::int AS product_count FROM categories c LEFT JOIN products p ON LOWER(TRIM(p.category))=LOWER(c.name) GROUP BY c.id ORDER BY c.name"
    );
    res.json({ categories: result.rows });
  } catch (error) { next(error); }
});

router.post("/", requireOwner, async (req, res, next) => {
  try {
    const name = cleanName(req.body?.name);
    const result = await pool.query(
      "INSERT INTO categories(name,slug,description) VALUES($1,$2,$3) RETURNING id,name,slug,description,is_active,created_at,updated_at",
      [name, slugify(name), typeof req.body?.description === "string" ? req.body.description.trim() || null : null]
    );
    res.status(201).json({ message: "Category created.", category: result.rows[0] });
  } catch (error) {
    if (error.code === "23505") error.status = 409, error.message = "A category with this name or URL slug already exists.";
    next(error);
  }
});

router.put("/:id", requireOwner, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid category ID." });
    const name = cleanName(req.body?.name);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query("SELECT name FROM categories WHERE id=$1 FOR UPDATE", [id]);
      if (!existing.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Category not found." }); }
      const oldName = existing.rows[0].name;
      const result = await client.query(
        "UPDATE categories SET name=$1,slug=$2,description=$3,updated_at=NOW() WHERE id=$4 RETURNING id,name,slug,description,is_active,created_at,updated_at",
        [name, slugify(name), typeof req.body?.description === "string" ? req.body.description.trim() || null : null, id]
      );
      await client.query("UPDATE products SET category=$1,updated_at=NOW() WHERE LOWER(TRIM(category))=LOWER($2)", [name, oldName]);
      await client.query("COMMIT");
      res.json({ message: "Category updated.", category: result.rows[0] });
    } catch (error) { await client.query("ROLLBACK"); throw error; }
    finally { client.release(); }
  } catch (error) {
    if (error.code === "23505") error.status = 409, error.message = "A category with this name or URL slug already exists.";
    next(error);
  }
});

router.patch("/:id/status", requireOwner, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "Invalid category ID." });
    if (typeof req.body?.is_active !== "boolean") return res.status(400).json({ error: "is_active must be true or false." });
    const result = await pool.query(
      "UPDATE categories SET is_active=$1,updated_at=NOW() WHERE id=$2 RETURNING id,name,is_active,updated_at",
      [req.body.is_active, id]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Category not found." });
    res.json({ message: req.body.is_active ? "Category activated." : "Category deactivated.", category: result.rows[0] });
  } catch (error) { next(error); }
});

export default router;
