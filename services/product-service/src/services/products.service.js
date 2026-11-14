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
  const stock = data.stock === undefined ? 0 : data.stock;
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

const productColumns = `id, name, description, category, price, image_url,
  is_active, created_by, created_at, updated_at, stock, brand, discount_percent`;

export async function listActiveProducts() {
  const result = await pool.query(
    `SELECT ${productColumns} FROM products
     WHERE is_active = TRUE ORDER BY created_at DESC, id DESC`
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
  const result = await pool.query(
    `INSERT INTO products
      (name, description, category, price, image_url, stock, brand, discount_percent, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING ${productColumns}`,
    [product.name, product.description, product.category, product.price,
     product.image_url, product.stock, product.brand, product.discount_percent, userId]
  );
  return result.rows[0];
}

export async function updateProduct(id, data) {
  const product = validateProduct(data);
  const result = await pool.query(
    `UPDATE products SET
       name=$1, description=$2, category=$3, price=$4, image_url=$5,
       stock=$6, brand=$7, discount_percent=$8, updated_at=NOW()
     WHERE id=$9 AND is_active=TRUE
     RETURNING ${productColumns}`,
    [product.name, product.description, product.category, product.price,
     product.image_url, product.stock, product.brand, product.discount_percent, id]
  );
  return result.rows[0] || null;
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

export function parseProductId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
