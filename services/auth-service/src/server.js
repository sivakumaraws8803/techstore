import "dotenv/config";
import express from "express";
import helmet from "helmet";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

import { pool } from "./config/database.js";
import authRoutes from "./routes/auth.routes.js";

const app = express();
const PORT = Number(process.env.PORT || 3001);
const SERVICE_NAME = "auth-service";

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error("SESSION_SECRET must be set to at least 32 characters");
}

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({ limit: "100kb" }));

const PgSession = connectPgSimple(session);
app.use(session({
  name: "techstore.sid",
  store: new PgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: false
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000
  }
}));

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({
      status: "ok",
      service: SERVICE_NAME,
      database: "connected",
      timestamp: new Date().toISOString()
    });
  } catch {
    res.status(503).json({
      status: "error",
      service: SERVICE_NAME,
      database: "unavailable"
    });
  }
});

app.get("/api/v1", (_req, res) => {
  res.json({
    service: SERVICE_NAME,
    version: "v1",
    endpoints: [
      "POST /api/auth/register",
      "POST /api/auth/login",
      "GET /api/auth/me",
      "POST /api/auth/logout"
    ]
  });
});

app.use("/api/auth", authRoutes);

app.use((req, res) => {
  res.status(404).json({ error: "NOT_FOUND", path: req.originalUrl });
});

app.use((err, _req, res, _next) => {
  console.error(\`[\${SERVICE_NAME}]\`, err.message);
  if (res.headersSent) return;
  res.status(err.status || 500).json({
    error: err.status ? err.message : "Internal server error"
  });
});

const server = app.listen(PORT, "127.0.0.1", () => {
  console.log(\`[\${SERVICE_NAME}] listening on 127.0.0.1:\${PORT}\`);
});

async function shutdown(signal) {
  console.log(\`[\${SERVICE_NAME}] \${signal} received; shutting down\`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
