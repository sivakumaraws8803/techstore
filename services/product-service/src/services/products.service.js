import { pool } from "../config/database.js";

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function validateProduct(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw httpError(400, "A product object is required.");
  }

  const { name, description, category, price, image_url, brand } = data;
  const rawStock = data.stock === undefined ? 0 : data.stock;
  const stock = typeof rawStock === "string" && /^\d+$/.test(rawStock.trim())
    ? Number(rawStock.trim())
    : rawStock;
  const discount = data.discount_percent === undefined ? 0 : data.discount_percent;

  if (typeof name !== "string" || !name.trim() || name.trim().length > 150) {
    throw httpError(400, "Product name is required (maximum 150 characters).");
  }
  if (typeof category !== "string" || !category.trim() || category.trim().length > 50) {
    throw httpError(400, "Category is required (maximum 50 characters).");
  }
  if (price === undefined || price === null || price === "" ||
      !Number.isFinite(Number(price)) || Number(price) < 0 || Number(price) > 9999999999.99) {
    throw httpError(400, "Price must be a valid non-negative amount.");
  }
  if (!Number.isSafeInteger(stock) || stock < 0) {
    throw httpError(400, "Stock must be a non-negative whole number.");
  }
  if (!Number.isFinite(Number(discount)) || Number(discount) < 0 || Number(discount) > 100) {
    throw httpError(400, "Discount must be between 0 and 100.");
  }
  if (description !== undefined && description !== null && typeof description !== "string") {
    throw httpError(400, "Description must be text.");
  }
  if (image_url !== undefined && image_url !== null && typeof image_url !== "string") {
    throw httpError(400, "Image URL must be text.");
  }
  if (brand !== undefined && brand !== null &&
      (typeof brand !== "string" || brand.trim().length > 100)) {
    throw httpError(400, "Brand must be text (maximum 100 characters).");
  }

  return {
    name: name.trim(),
    description: description?.trim() || null,
    category: category.trim(),
    price: Number(price),
    image_url: image_url?.trim() || null,
    stock,
    brand: brand?.trim() || null,
    discount_percent: Number(discount)
  };
}

async function assertActiveCategory(category) {
  const result = await pool.query("SELECT id FROM categories WHERE LOWER(name)=LOWER($1) AND is_active=TRUE", [category]);
  if (!result.rowCount) throw httpError(400, "Select an active category from the category list.");
}

const productColumns = `id, name, description, category, price, image_url,
  is_active, created_by, created_at, updated_at, stock, brand, discount_percent`;

export async function listActiveProducts() {
  const result = await pool.query(
    `SELECT ${productColumns} FROM products
     WHERE is_active = TRUE ORDER BY created_at DESC, id DESC`
  );
  return result.rows;
}

export async function listAdminProducts() {
  const result = await pool.query(
    `SELECT ${productColumns} FROM products
     ORDER BY created_at DESC, id DESC`
  );
  return result.rows;
}

export async function findActiveProductById(id) {
  const result = await pool.query(
    `SELECT ${productColumns} FROM products WHERE id = $1 AND is_active = TRUE`,
    [id]
  );
  return result.rows[0] || null;
}

export async function createProduct(data, userId) {
  const product = validateProduct(data);
  await assertActiveCategory(product.category);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO products
        (name, description, category, price, image_url, stock, brand, discount_percent, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING ${productColumns}`,
      [product.name, product.description, product.category, product.price,
       product.image_url, product.stock, product.brand, product.discount_percent, userId]
    );
    const created = result.rows[0];
    await client.query(
      `INSERT INTO product_variants(product_id,sku,name,attributes,price,stock,image_url)
       VALUES($1,$2,'Standard','{}'::jsonb,$3,$4,$5)`,
      [created.id, "TS-" + created.id + "-DEFAULT", product.price, product.stock, product.image_url]
    );
    await client.query("COMMIT");
    return created;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateProduct(id, data) {
  const product = validateProduct(data);
  await assertActiveCategory(product.category);
  const result = await pool.query(
    `UPDATE products SET
       name=$1, description=$2, category=$3, price=$4, image_url=$5,
       stock=$6, brand=$7, discount_percent=$8, updated_at=NOW()
     WHERE id=$9
     RETURNING ${productColumns}`,
    [product.name, product.description, product.category, product.price,
     product.image_url, product.stock, product.brand, product.discount_percent, id]
  );
  if (!result.rows[0]) return null;
  const variantSummary = await pool.query(
    "SELECT COUNT(*)::int AS total FROM product_variants WHERE product_id=$1 AND is_active=TRUE",
    [id]
  );
  if (variantSummary.rows[0].total === 1) {
    await pool.query(
      "UPDATE product_variants SET price=$1,stock=$2,image_url=$3,updated_at=NOW() WHERE product_id=$4 AND is_active=TRUE",
      [product.price,product.stock,product.image_url,id]
    );
  } else if (variantSummary.rows[0].total > 1) {
    await pool.query(
      "UPDATE products SET price=COALESCE((SELECT MIN(price) FROM product_variants WHERE product_id=$1 AND is_active=TRUE),price), stock=COALESCE((SELECT SUM(stock) FROM product_variants WHERE product_id=$1 AND is_active=TRUE),0) WHERE id=$1",
      [id]
    );
  }
  const refreshed = await pool.query(`SELECT ${productColumns} FROM products WHERE id=$1`,[id]);
  return refreshed.rows[0];
}

export async function deactivateProduct(id) {
  const result = await pool.query(
    `UPDATE products SET is_active=FALSE, updated_at=NOW()
     WHERE id=$1 AND is_active=TRUE
     RETURNING id, name, is_active, updated_at`,
    [id]
  );
  return result.rows[0] || null;
}

export async function activateProduct(id) {
  const result = await pool.query(
    `UPDATE products SET is_active=TRUE, updated_at=NOW()
     WHERE id=$1 AND is_active=FALSE
     RETURNING id, name, is_active, updated_at`,
    [id]
  );
  return result.rows[0] || null;
}

export function parseProductId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
