import { Router } from "express";
import multer from "multer";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import {
  listActiveProducts, listAdminProducts, findActiveProductById,
  createProduct, updateProduct, deactivateProduct, parseProductId
} from "../services/products.service.js";

const router = Router();
const uploadDir = process.env.PRODUCT_UPLOAD_DIR || "/usr/share/nginx/techstore/uploads/products";
fs.mkdirSync(uploadDir, { recursive: true });

const allowedTypes = new Map([
  ["image/jpeg", ".jpg"], ["image/png", ".png"],
  ["image/webp", ".webp"], ["image/avif", ".avif"]
]);
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => cb(null, randomUUID() + (allowedTypes.get(file.mimetype) || ".img"))
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!allowedTypes.has(file.mimetype)) return cb(Object.assign(new Error("Upload JPG, PNG, WEBP or AVIF images only."), { status: 400 }));
    cb(null, true);
  }
});

function requireAuth(req, res, next) {
  if (!req.session?.user) return res.status(401).json({ error: "Authentication required." });
  next();
}
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.user) return res.status(401).json({ error: "Authentication required." });
    if (!roles.includes(req.session.user.role)) return res.status(403).json({ error: "You do not have permission to perform this action." });
    next();
  };
}
function receiveImage(req, res, next) {
  upload.single("image")(req, res, (error) => {
    if (error) return res.status(error.status || 400).json({ error: error.message || "Image upload failed." });
    if (req.file) req.body.image_url = "/uploads/products/" + path.basename(req.file.filename);
    next();
  });
}

router.get("/", async (_req, res, next) => {
  try { res.json({ products: await listActiveProducts() }); } catch (error) { next(error); }
});
router.get("/admin", requireAuth, requireRole("owner", "product_manager"), async (_req, res, next) => {
  try { res.json({ products: await listAdminProducts() }); } catch (error) { next(error); }
});
router.get("/:id", async (req, res, next) => {
  try {
    const id = parseProductId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid product ID." });
    const product = await findActiveProductById(id);
    if (!product) return res.status(404).json({ error: "Product not found." });
    res.json({ product });
  } catch (error) { next(error); }
});
router.post("/", requireAuth, requireRole("owner", "product_manager"), receiveImage, async (req, res, next) => {
  try {
    const product = await createProduct(req.body, req.session.user.id);
    res.status(201).json({ message: "Product created successfully.", product });
  } catch (error) { next(error); }
});
router.put("/:id", requireAuth, requireRole("owner", "product_manager"), receiveImage, async (req, res, next) => {
  try {
    const id = parseProductId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid product ID." });
    const product = await updateProduct(id, req.body);
    if (!product) return res.status(404).json({ error: "Product not found." });
    res.json({ message: "Product updated successfully.", product });
  } catch (error) { next(error); }
});
router.patch("/:id/deactivate", requireAuth, requireRole("owner"), async (req, res, next) => {
  try {
    const id = parseProductId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid product ID." });
    const product = await deactivateProduct(id);
    if (!product) return res.status(404).json({ error: "Product not found." });
    res.json({ message: "Product deactivated successfully.", product });
  } catch (error) { next(error); }
});

export default router;