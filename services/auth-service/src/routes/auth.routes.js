import { Router } from "express";
import {
  authenticateUser,
  registerCustomer
} from "../services/auth.service.js";

const router = Router();

router.post("/register", async (req, res, next) => {
  try {
    const { fullName, email, password } = req.body || {};
    if (
      typeof fullName !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      !fullName.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: "Full name, email and password are required."
      });
    }

    const user = await registerCustomer({ fullName, email, password });
    return res.status(201).json({
      message: "Account created successfully. Please log in.",
      user
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const identifier = req.body?.email ?? req.body?.username;
    const password = req.body?.password;

    if (
      typeof identifier !== "string" ||
      typeof password !== "string" ||
      !identifier.trim() ||
      !password
    ) {
      return res.status(400).json({
        error: "Email or username and password are required."
      });
    }

    const user = await authenticateUser(identifier.trim(), password);
    if (!user) {
      return res.status(401).json({
        error: "Invalid email/username or password."
      });
    }

    await new Promise((resolve, reject) => {
      req.session.regenerate((error) => error ? reject(error) : resolve());
    });
    req.session.user = user;
    await new Promise((resolve, reject) => {
      req.session.save((error) => error ? reject(error) : resolve());
    });

    return res.json({ message: "Login successful", user });
  } catch (error) {
    next(error);
  }
});

router.get("/me", (req, res) => {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  return res.json({ user: req.session.user });
});

router.post("/logout", async (req, res, next) => {
  try {
    if (req.session) {
      await new Promise((resolve, reject) => {
        req.session.destroy((error) => error ? reject(error) : resolve());
      });
    }
    res.clearCookie("techstore.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production"
    });
    return res.json({ message: "Logout successful" });
  } catch (error) {
    next(error);
  }
});

export default router;
