import { Router } from "express";
import { signIn, signUp, getMe, verifyToken, forgotPassword, resetPassword } from "../controllers/auth.controller.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

const router = Router();

// Public routes for email/password auth
router.post("/signup", signUp);
router.post("/signin", signIn);

// Protected routes (require valid JWT token)
router.get("/me", authMiddleware, getMe);
router.post("/verify", authMiddleware, verifyToken);

// Password reset routes
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;
