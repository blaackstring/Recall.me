import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";

/**
 * Extends Express Request to include the authenticated user.
 */
export interface AuthenticatedRequest extends Request {
    user?: {
        uid: string;
        email: string;
    };
}

/**
 * JWT Auth middleware.
 *
 * Expects:  Authorization: Bearer <jwt-token>
 *
 * On success → attaches req.user and calls next().
 * On failure → returns 401.
 */
export const authMiddleware = async (
    req: AuthenticatedRequest,
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

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { uid: string; email: string };

        req.user = {
            uid: decoded.uid,
            email: decoded.email,
        };

        next();
    } catch (error: any) {
        if (error.name === "TokenExpiredError") {
            res.status(401).json({ error: "Token expired, please sign in again" });
            return;
        }

        res.status(401).json({ error: "Invalid token" });
        return;
    }
};
