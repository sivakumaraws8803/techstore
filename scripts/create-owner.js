import 'dotenv/config';
import bcrypt from 'bcrypt';
import { pool } from '../src/config/database.js';

async function createOwner() {
    const username = process.env.OWNER_USERNAME?.trim();
    const password = process.env.OWNER_PASSWORD;

    if (!username || !password) {
        throw new Error('Owner username and password are required.');
    }

    if (!/^[a-zA-Z0-9_.-]{3,50}$/.test(username)) {
        throw new Error(
            'Username must be 3-50 characters using letters, numbers, _, . or -.'
        );
    }

    if (password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) {
        throw new Error(
            'Password must be at least 12 characters and no more than 72 bytes.'
        );
    }

    const existingOwner = await pool.query(
        "SELECT id FROM users WHERE role = 'owner' LIMIT 1"
    );

    if (existingOwner.rowCount > 0) {
        throw new Error(
            'An owner already exists. Refusing to create another owner.'
        );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
        `INSERT INTO users (username, password_hash, role, is_active)
         VALUES ($1, $2, 'owner', TRUE)`,
        [username, passwordHash]
    );

    console.log(`Owner account "${username}" created successfully.`);
}

try {
    await createOwner();
} catch (error) {
    console.error('Owner setup failed:', error.message);
    process.exitCode = 1;
} finally {
    await pool.end();
}
