import { pool } from '../config/database.js';
import bcrypt from 'bcrypt';

export async function authenticateUser(username, password) {
    const result = await pool.query(
        `SELECT id, username, password_hash, role, is_active
         FROM users
         WHERE username = $1`,
        [username]
    );

    const user = result.rows[0];

    if (!user || !user.is_active) {
        return null;
    }

    const passwordMatches = await bcrypt.compare(
        password,
        user.password_hash
    );

    if (!passwordMatches) {
        return null;
    }

    return {
        id: user.id,
        username: user.username,
        role: user.role
    };
}
