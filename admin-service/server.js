import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const PORT = Number(process.env.PORT || 3010);
const HOST = process.env.HOST || "127.0.0.1";
const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(here, "public");

app.disable("x-powered-by");
app.use(express.static(publicDir, {
  index: false,
  dotfiles: "deny",
  etag: true,
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0
}));

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", service: "admin-web" });
});

app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "login.html")));
app.get("/login", (_req, res) => res.sendFile(path.join(publicDir, "login.html")));
app.get("/dashboard", (_req, res) => res.sendFile(path.join(publicDir, "dashboard.html")));

app.use((_req, res) => res.status(404).send("Not found"));

const server = app.listen(PORT, HOST, () => {
  console.log(`[admin-web] listening on ${HOST}:${PORT}`);
});

function shutdown(signal) {
  console.log(`[admin-web] ${signal} received; shutting down`);
  server.close(() => process.exit(0));
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
