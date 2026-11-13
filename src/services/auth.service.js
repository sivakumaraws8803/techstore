import { pool } from '../config/database.js';
import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import { createCustomer, findUserByEmail } from '../repositories/users.repository.js';

export async function authenticateUser(identifier, password) {
    const result = await pool.query(
        \`SELECT id, username, full_name, email, password_hash, role, is_active
         FROM users
         WHERE LOWER(username) = LOWER($1)
            OR LOWER(email) = LOWER($1)
         LIMIT 1\`,
        [identifier]
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
        full_name: user.full_name,
        email: user.email,
        role: user.role
    };
}

export async function registerCustomer({ fullName, email, password }) {
    const normalizedName = fullName.trim().replace(/\s+/g, ' ');
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedName.length < 2 || normalizedName.length > 100) {
        const error = new Error('Full name must be between 2 and 100 characters.');
        error.status = 400;
        throw error;
    }

    if (normalizedEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        const error = new Error('Please enter a valid email address.');
        error.status = 400;
        throw error;
    }

    if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
        const error = new Error('Password must be at least 12 characters and no more than 72 bytes.');
        error.status = 400;
        throw error;
    }

    if (await findUserByEmail(normalizedEmail)) {
        const error = new Error('An account with this email already exists.');
        error.status = 409;
        throw error;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const username = \`customer_\${randomBytes(8).toString('hex')}\`;

    try {
        return await createCustomer({
            username,
            fullName: normalizedName,
            email: normalizedEmail,
            passwordHash
        });
    } catch (error) {
        if (error.code === '23505') {
            const duplicateError = new Error('An account with this email already exists.');
            duplicateError.status = 409;
            throw duplicateError;
        }
        throw error;
    }
}
