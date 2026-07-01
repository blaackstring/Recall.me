import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { AuthenticatedRequest } from "../middleware/auth.middleware.js";
import { createUser, verifyUser, findUserByUid, findUserByEmail, updateUserPassword } from "../services/user.service.js";

function generateToken(uid: string, email: string) {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }
    // Token expires in 7 days
    return jwt.sign({ uid, email }, secret, { expiresIn: "7d" });
}

/**
 * POST /auth/signup
 * Request body: { email, password, name }
 */
export const signUp = async (req: Request, res: Response) => {
    try {
        const { email, password, name } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: "Email, password, and name are required" });
        }

        const user = await createUser(email, password, name);
        const token = generateToken(user.uid, user.email);

        res.status(201).json({
            message: "User created successfully",
            token,
            user,
        });
    } catch (error: any) {
        console.error("❌ Sign-up error:", error);
        if (error.message === "Email already registered") {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: "Internal server error during sign-up" });
    }
};

/**
 * POST /auth/signin
 * Request body: { email, password }
 */
export const signIn = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "Email and password are required" });
        }

        const user = await verifyUser(email, password);
        const token = generateToken(user.uid, user.email);

        res.status(200).json({
            message: "Sign-in successful",
            token,
            user,
        });
    } catch (error: any) {
        console.error("❌ Sign-in error:", error);
        if (error.message === "Invalid email or password") {
            return res.status(401).json({ error: error.message });
        }
        res.status(500).json({ error: "Internal server error during sign-in" });
    }
};

/**
 * GET /auth/me
 * Requires a valid JWT token in the Authorization header.
 */
export const getMe = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const userReq = req.user;

        if (!userReq) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const user = await findUserByUid(userReq.uid);
        
        if (!user) {
             return res.status(404).json({ error: "User not found" });
        }

        res.status(200).json({ user });
    } catch (error: any) {
        console.error("❌ Get user error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

/**
 * POST /auth/verify
 * Lightweight endpoint that simply verifies the token is valid.
 */
export const verifyToken = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.user) {
            return res.status(401).json({ valid: false });
        }

        res.status(200).json({
            valid: true,
            uid: req.user.uid,
        });
    } catch (error: any) {
        console.error("❌ Token verification error:", error);
        res.status(500).json({ valid: false, error: "Verification failed" });
    }
};
/**
 * POST /auth/forgot-password
 * Request body: { email }
 */
export const forgotPassword = async (req: Request, res: Response) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required" });
        }

        // 1. Check if user exists in AstraDB or Firebase
        const user = await findUserByEmail(email);
        
        // Even if user not found, we return 200 for security reasons (don't leak registered emails)
        if (!user) {
            console.log(`⚠️ User not found for email: ${email}`);
            return res.status(200).json({ message: "If an account exists, a reset code has been sent." });
        }

        // 2. Generate and store OTP
        const { createOTP } = await import("../services/otp.service.js");
        const code = await createOTP(email);

        // 3. Send email with code
        const { sendOTPEmail } = await import("../services/mail.service.js");
        await sendOTPEmail(email, code);

        res.status(200).json({
            message: "A verification code has been sent to your email.",
        });
    } catch (error: any) {
        console.error("❌ Forgot password error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};

/**
 * POST /auth/reset-password
 * Request body: { email, code, newPassword }
 */
export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { email, code, newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return res.status(400).json({ error: "Email, code, and new password are required" });
        }

        // 1. Verify OTP
        const { verifyOTP } = await import("../services/otp.service.js");
        const isValid = await verifyOTP(email, code);
        if (!isValid) {
            return res.status(400).json({ error: "Invalid or expired verification code" });
        }

        // 2. Update password in AstraDB
        await updateUserPassword(email, newPassword);

        // 3. Update password in Firebase Auth (if user exists in Firebase)
        try {
            const { authAdmin } = await import("../services/firebase-admin.service.js");
            const firebaseUser = await authAdmin.getUserByEmail(email);
            if (firebaseUser) {
                await authAdmin.updateUser(firebaseUser.uid, { password: newPassword });
                console.log(`🔥 Updated Firebase password for ${email}`);
            }
        } catch (firebaseErr: any) {
            // Log but don't fail reset if Firebase user is not found
            console.warn(`⚠️ Could not update Firebase user: ${firebaseErr.message}`);
        }

        res.status(200).json({
            message: "Password reset successful. You can now log in.",
        });
    } catch (error: any) {
        console.error("❌ Reset password error:", error);
        res.status(500).json({ error: "Internal server error" });
    }
};
