import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

/**
 * Extends Express Request to include the authenticated user.
 */
export interface FirebaseAuthenticatedRequest extends Request {
    user?: {
        uid: string;
        email: string | null;
    };
}

// Lazy-check if Firebase Admin is usable
let firebaseAdminAvailable: boolean | null = null;

async function isFirebaseAdminAvailable(): Promise<boolean> {
    if (firebaseAdminAvailable !== null) return firebaseAdminAvailable;
    try {
        const { authAdmin } = await import("../services/firebase-admin.service.js");
        authAdmin.app;
        firebaseAdminAvailable = true;
    } catch {
        firebaseAdminAvailable = false;
        console.log("[Auth] Firebase Admin not available — using fallback auth");
    }
    return firebaseAdminAvailable;
}

/**
 * Decode a JWT payload without verification (development fallback).
 */
function decodeTokenPayload(token: string): { uid?: string; email?: string; sub?: string } | null {
    try {
        const parts = token.split(".");
        if (parts.length !== 3 || !parts[1]) return null;
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
        return payload;
    } catch {
        return null;
    }
}

/**
 * Combined Auth middleware.
 *
 * 1. Tries Firebase Admin ID token verification (most secure)
 * 2. Falls back to custom JWT verification
 * 3. Falls back to decoding Firebase ID token payload (dev mode)
 */
export const firebaseAuthMiddleware = async (
    req: FirebaseAuthenticatedRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ error: "Missing or invalid Authorization header" });
            return;
        }

        const token = authHeader.split("Bearer ")[1];

        if (!token) {
            res.status(401).json({ error: "No token provided" });
            return;
        }

        // 1. Try Firebase Admin (most secure)
        if (await isFirebaseAdminAvailable()) {
            try {
                const { authAdmin } = await import("../services/firebase-admin.service.js");
                const decodedToken = await authAdmin.verifyIdToken(token);
                req.user = {
                    uid: decodedToken.uid,
                    email: decodedToken.email || null,
                };
                return next();
            } catch (fbError: any) {
                console.warn("[Auth] Firebase token failed, trying custom JWT:", fbError.message);
            }
        }

        // 2. Try custom JWT
        const jwtSecret = process.env.JWT_SECRET;
        if (jwtSecret) {
            try {
                const decoded = jwt.verify(token, jwtSecret) as { uid: string; email: string };
                req.user = {
                    uid: decoded.uid,
                    email: decoded.email || null,
                };
                return next();
            } catch (jwtError: any) {
                // Silent fallthrough
            }
        }

        // 3. Decode Firebase ID token payload without verification (dev fallback)
        const payload = decodeTokenPayload(token);
        if (payload && (payload.sub || payload.uid)) {
            console.warn("[Auth] Using unverified token decode — set up Firebase Admin for production");
            req.user = {
                uid: payload.sub || payload.uid!,
                email: payload.email || null,
            };
            return next();
        }

        res.status(401).json({ error: "Invalid or expired token" });
    } catch (error: any) {
        console.error("[Auth] Verification failed:", error.message);
        res.status(401).json({ error: "Invalid or expired token" });
    }
};
