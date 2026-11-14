import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { pool } from "../config/database.js";

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function publicUser(row) {
  return {
    id: row.id,
    username: row.username,
    full_name: row.full_name,
    email: row.email,
    role: row.role
  };
}

export async function authenticateUser(identifier, password) {
  const result = await pool.query(
    \`SELECT id, username, full_name, email, password_hash, role, is_active
     FROM users
     WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
     LIMIT 1\`,
    [identifier]
  );

  const user = result.rows[0];
  if (!user || !user.is_active) return null;

  const matches = await bcrypt.compare(password, user.password_hash);
  return matches ? publicUser(user) : null;
}

export async function registerCustomer({ fullName, email, password }) {
  const normalizedName = fullName.trim().replace(/\s+/g, " ");
  const normalizedEmail = email.trim().toLowerCase();

  if (normalizedName.length < 2 || normalizedName.length > 100) {
    throw httpError(400, "Full name must be between 2 and 100 characters.");
  }
  if (
    normalizedEmail.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
  ) {
    throw httpError(400, "Please enter a valid email address.");
  }
  if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
    throw httpError(400, "Password must be at least 12 characters and no more than 72 bytes.");
  }

  const existing = await pool.query(
    "SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1",
    [normalizedEmail]
  );
  if (existing.rowCount) {
    throw httpError(409, "An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const username = \`customer_\${randomBytes(8).toString("hex")}\`;

  try {
    const result = await pool.query(
      \`INSERT INTO users
         (username, full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, 'customer', TRUE)
       RETURNING id, username, full_name, email, role\`,
      [username, normalizedName, normalizedEmail, passwordHash]
    );
    return publicUser(result.rows[0]);
  } catch (error) {
    if (error.code === "23505") {
      throw httpError(409, "An account with this email already exists.");
    }
    throw error;
  }
}
