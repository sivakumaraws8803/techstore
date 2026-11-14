import "dotenv/config";
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "techstore",
  user: process.env.DB_USER || "techstore_app",
  password: process.env.DB_PASSWORD,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on("error", (error) => {
  console.error("[auth-service] PostgreSQL pool error:", error.message);
});
