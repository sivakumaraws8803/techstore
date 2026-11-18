import "dotenv/config";
import express from "express";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { randomUUID } from "node:crypto";
import { pool } from "./config/database.js";

const app = express();
const PORT = Number(process.env.PORT || 3005);
const SERVICE = "payment-service";

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must match auth-service");
}
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({ limit: "20kb" }));

const PgSession = connectPgSimple(session);
app.use(session({
  name: "techstore.sid",
  store: new PgSession({ pool, tableName: "user_sessions", createTableIfMissing: false }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: process.env.COOKIE_SECURE === "true", sameSite: "lax", maxAge: 8 * 60 * 60 * 1000 }
}));

app.use("/api/payments", (_req, res, next) => {
  res.set({ "Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache", "Expires": "0" });
  next();
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", service: SERVICE, database: "connected", timestamp: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "error", service: SERVICE, database: "unavailable" });
  }
});

// Development simulator only: no card data is collected and no real money is moved.
app.post("/api/payments/orders/:orderId/simulate", async (req, res, next) => {
  const user = req.session?.user;
  if (!user) return res.status(401).json({ error: "Authentication required" });
  if (user.role !== "customer") return res.status(403).json({ error: "Customer account required" });

  const orderId = Number(req.params.orderId);
  const outcome = req.body?.outcome;
  if (!Number.isSafeInteger(orderId) || orderId <= 0) return res.status(400).json({ error: "Invalid order ID" });
  if (!["success", "failed", "cancelled"].includes(outcome)) {
    return res.status(400).json({ error: "Outcome must be success, failed, or cancelled" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(
      "SELECT id, customer_id, status, payment_status, total_amount FROM orders WHERE id = $1 FOR UPDATE",
      [orderId]
    );
    if (!found.rowCount || String(found.rows[0].customer_id) !== String(user.id)) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Order not found" });
    }
    const order = found.rows[0];
    if (order.payment_status === "paid") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Order is already paid" });
    }
    if (order.status === "cancelled") {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "Cancelled orders cannot be paid" });
    }

    const reference = "DUMMY-" + randomUUID();
    await client.query(
      "INSERT INTO payments (order_id, customer_id, amount, payment_method, status, transaction_reference) VALUES ($1, $2, $3, 'dummy', $4, $5)",
      [order.id, user.id, order.total_amount, outcome, reference]
    );
    const paymentStatus = outcome === "success" ? "paid" : outcome;
    await client.query("UPDATE orders SET payment_status = $1, updated_at = NOW() WHERE id = $2", [paymentStatus, order.id]);
    await client.query("COMMIT");

    res.status(201).json({
      message: outcome === "success" ? "Dummy payment successful" : "Dummy payment " + outcome,
      payment: { reference, amount: order.total_amount, status: outcome },
      order: { id: order.id, status: order.status, payment_status: paymentStatus }
    });
  } catch (error) {
    await client.query("ROLLBACK");
    next(error);
  } finally {
    client.release();
  }
});

app.use((req, res) => res.status(404).json({ error: "NOT_FOUND", path: req.originalUrl }));
app.use((error, _req, res, _next) => {
  console.error("[payment-service]", error.message);
  if (!res.headersSent) res.status(500).json({ error: "Internal server error" });
});

const server = app.listen(PORT, "127.0.0.1", () => console.log(`[${SERVICE}] listening on 127.0.0.1:${PORT}`));
async function shutdown(signal) {
  console.log(`[${SERVICE}] ${signal} received; shutting down`);
  server.close(async () => { await pool.end(); process.exit(0); });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
