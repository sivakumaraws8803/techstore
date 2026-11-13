import { pool } from '../config/database.js';

export async function findUserByUsername(username) {
    const result = await pool.query(
        'SELECT id FROM users WHERE username = $1',
        [username]
    );
    return result.rows[0] || null;
}

export async function createUser({ username, passwordHash, role }) {
    const result = await pool.query(
        `INSERT INTO users (username, password_hash, role, is_active)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id, username, role, is_active, created_at`,
        [username, passwordHash, role]
    );
    return result.rows[0];
}

export async function createCustomer({ username, fullName, email, passwordHash }) {
    const result = await pool.query(
        `INSERT INTO users (username, full_name, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, 'customer', TRUE)
         RETURNING id, username, full_name, email, role, is_active, created_at`,
        [username, fullName, email, passwordHash]
    );
    return result.rows[0];
}

export async function findUserByEmail(email) {
    const result = await pool.query(
        'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
        [email]
    );
    return result.rows[0] || null;
}

export async function listUsers() {
    const result = await pool.query(
        `SELECT id, username, role, is_active, created_at
         FROM users
         ORDER BY id`
    );
    return result.rows;
}

export async function updateUserRole(id, role) {
    const result = await pool.query(
        `UPDATE users
         SET role = $1, updated_at = NOW()
         WHERE id = $2 AND role <> 'owner'
         RETURNING id, username, role, is_active`,
        [role, id]
    );
    return result.rows[0] || null;
}

export async function deactivateUser(id) {
    const result = await pool.query(
        `UPDATE users
         SET is_active = FALSE, updated_at = NOW()
         WHERE id = $1 AND role <> 'owner'
         RETURNING id, username, role, is_active`,
        [id]
    );
    return result.rows[0] || null;
}
