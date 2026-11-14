import "dotenv/config";
import express from "express";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { pool } from "./config/database.js";
import { initializeCartSchema } from "./services/cart.service.js";
import cartRoutes from "./routes/cart.routes.js";
const app = express();
const PORT = Number(process.env.PORT || 3003);
const SERVICE_NAME = "cart-service";
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET must match auth-service");
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({ limit: "50kb" }));
const PgSession = connectPgSimple(session);
app.use(session({ name: "techstore.sid", store: new PgSession({ pool, tableName: "user_sessions", createTableIfMissing: false }), secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false, cookie: { httpOnly: true, secure: process.env.COOKIE_SECURE === "true", sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 } }));
app.use("/api/cart", (_req, res, next) => { res.set({ "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache", "Expires": "0" }); next(); });
app.get("/health", async (_req, res) => {
  try { await pool.query("SELECT 1"); res.status(200).json({ status: "ok", service: SERVICE_NAME, database: "connected", timestamp: new Date().toISOString() }); }
  catch { res.status(503).json({ status: "error", service: SERVICE_NAME, database: "unavailable" }); }
});
app.get("/api/v1", (_req, res) => res.json({ service: SERVICE_NAME, version: "v1", endpoints: ["GET /api/cart", "POST /api/cart/items", "PATCH /api/cart/items/:productId", "DELETE /api/cart/items/:productId", "DELETE /api/cart"] }));
app.use("/api/cart", cartRoutes);
app.use((req, res) => res.status(404).json({ error: "NOT_FOUND", path: req.originalUrl }));
app.use((error, _req, res, _next) => { console.error("[" + SERVICE_NAME + "]", error.message); if (!res.headersSent) res.status(error.status || 500).json({ error: error.status ? error.message : "Internal server error" }); });
await initializeCartSchema();
const server = app.listen(PORT, "127.0.0.1", () => console.log("[" + SERVICE_NAME + "] listening on 127.0.0.1:" + PORT));
async function shutdown(signal) { console.log("[" + SERVICE_NAME + "] " + signal + " received; shutting down"); server.close(async () => { await pool.end(); process.exit(0); }); }
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));