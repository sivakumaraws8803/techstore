import { pool } from '../config/database.js';

export async function listActiveProducts() {
    const result = await pool.query(
        `SELECT id, name, description, category, price, image_url, created_at
         FROM products
         WHERE is_active = TRUE
         ORDER BY id DESC`
    );
    return result.rows;
}

export async function findProductById(id) {
    const result = await pool.query(
        `SELECT id, name, description, category, price, image_url,
                is_active, created_by, created_at, updated_at
         FROM products
         WHERE id = $1`,
        [id]
    );
    return result.rows[0] || null;
}

export async function createProduct(product, userId) {
    const { name, description, category, price, image_url } = product;

    const result = await pool.query(
        `INSERT INTO products
            (name, description, category, price, image_url, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, description, category, price, image_url,
                   is_active, created_by, created_at`,
        [name, description || null, category, price, image_url || null, userId]
    );
    return result.rows[0];
}

export async function updateProduct(id, product) {
    const { name, description, category, price, image_url } = product;

    const result = await pool.query(
        `UPDATE products
         SET name = $1,
             description = $2,
             category = $3,
             price = $4,
             image_url = $5,
             updated_at = NOW()
         WHERE id = $6
         RETURNING id, name, description, category, price, image_url,
                   is_active, created_by, updated_at`,
        [name, description || null, category, price, image_url || null, id]
    );
    return result.rows[0] || null;
}

export async function deactivateProduct(id) {
    const result = await pool.query(
        `UPDATE products
         SET is_active = FALSE, updated_at = NOW()
         WHERE id = $1
         RETURNING id, name, is_active`,
        [id]
    );
    return result.rows[0] || null;
}
