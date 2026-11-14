import { Router } from "express";
import {
  listActiveProducts, findActiveProductById, createProduct,
  updateProduct, deactivateProduct, parseProductId
} from "../services/products.service.js";

const router = Router();

function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Authentication required." });
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: "Authentication required." });
    }
    if (!roles.includes(req.session.user.role)) {
      return res.status(403).json({ error: "You do not have permission to perform this action." });
    }
    next();
  };
}

router.get("/", async (_req, res, next) => {
  try {
    res.json({ products: await listActiveProducts() });
  } catch (error) { next(error); }
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

router.post("/", requireAuth, requireRole("owner", "product_manager"), async (req, res, next) => {
  try {
    const product = await createProduct(req.body, req.session.user.id);
    res.status(201).json({ message: "Product created successfully.", product });
  } catch (error) { next(error); }
});

router.put("/:id", requireAuth, requireRole("owner", "product_manager"), async (req, res, next) => {
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
