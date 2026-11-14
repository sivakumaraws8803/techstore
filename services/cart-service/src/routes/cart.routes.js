import { Router } from "express";
import { addCartItem, clearCart, getCart, removeCartItem, updateCartItem } from "../services/cart.service.js";
const router = Router();
function requireAuth(req, res, next) {
  if (!req.session?.user?.id) return res.status(401).json({ error: "Authentication required." });
  next();
}
router.use(requireAuth);
router.get("/", async (req, res, next) => { try { res.json({ cart: await getCart(req.session.user.id) }); } catch (error) { next(error); } });
router.post("/items", async (req, res, next) => { try { const cart = await addCartItem(req.session.user.id, req.body?.productId, req.body?.quantity ?? 1); res.json({ message: "Item added to cart.", cart }); } catch (error) { next(error); } });
router.patch("/items/:productId", async (req, res, next) => { try { const cart = await updateCartItem(req.session.user.id, req.params.productId, req.body?.quantity); res.json({ message: "Cart quantity updated.", cart }); } catch (error) { next(error); } });
router.delete("/items/:productId", async (req, res, next) => { try { const cart = await removeCartItem(req.session.user.id, req.params.productId); res.json({ message: "Item removed from cart.", cart }); } catch (error) { next(error); } });
router.delete("/", async (req, res, next) => { try { const cart = await clearCart(req.session.user.id); res.json({ message: "Cart cleared.", cart }); } catch (error) { next(error); } });
export default router;