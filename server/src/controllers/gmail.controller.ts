import type { Response } from "express";
import type { FirebaseAuthenticatedRequest } from "../middleware/firebase-auth.middleware.js";
import { config } from "../config.js";
import { saveGmailTokens, getGmailTokens, removeGmailTokens, isGmailConnected } from "../services/user.service.js";

const GMAIL_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.compose",
].join(" ");

/**
 * POST /gmail/connect
 * Exchanges an authorization code for Gmail OAuth tokens and stores them.
 * Request body: { code: string }
 */
export const connectGmail = async (req: FirebaseAuthenticatedRequest, res: Response) => {
    try {
        const uid = req.user?.uid;
        if (!uid) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const { code, redirectUri } = req.body;
        if (!code) {
            return res.status(400).json({ error: "Authorization code is required" });
        }

        if (!config.gmailClientId || !config.gmailClientSecret) {
            return res.status(500).json({ error: "Gmail OAuth is not configured on the server" });
        }

        // Exchange authorization code for tokens
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: config.gmailClientId,
                client_secret: config.gmailClientSecret,
                redirect_uri: redirectUri || "postmessage",
                grant_type: "authorization_code",
            }),
        });

        const tokenData = await tokenResponse.json() as any;

        if (!tokenResponse.ok) {
            console.error("[Gmail] Token exchange failed:", tokenData);
            return res.status(400).json({
                error: "Failed to exchange authorization code",
                details: tokenData.error_description || tokenData.error,
            });
        }

        // Store tokens in AstraDB
        await saveGmailTokens(uid, {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            scope: tokenData.scope || GMAIL_SCOPES,
            token_type: tokenData.token_type || "Bearer",
            expiry_date: Date.now() + (tokenData.expires_in || 3600) * 1000,
        });

        res.status(200).json({
            message: "Gmail connected successfully",
            connected: true,
        });
    } catch (error: any) {
        console.error("[Gmail] Connect error:", error);
        res.status(500).json({ error: "Failed to connect Gmail" });
    }
};

/**
 * POST /gmail/disconnect
 * Removes stored Gmail OAuth tokens for the user.
 */
export const disconnectGmail = async (req: FirebaseAuthenticatedRequest, res: Response) => {
    try {
        const uid = req.user?.uid;
        if (!uid) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        await removeGmailTokens(uid);

        res.status(200).json({
            message: "Gmail disconnected successfully",
            connected: false,
        });
    } catch (error: any) {
        console.error("[Gmail] Disconnect error:", error);
        res.status(500).json({ error: "Failed to disconnect Gmail" });
    }
};

/**
 * GET /gmail/status
 * Returns whether the user has Gmail connected.
 */
export const gmailStatus = async (req: FirebaseAuthenticatedRequest, res: Response) => {
    try {
        const uid = req.user?.uid;
        if (!uid) {
            return res.status(401).json({ error: "Not authenticated" });
        }

        const connected = await isGmailConnected(uid);

        res.status(200).json({ connected });
    } catch (error: any) {
        console.error("[Gmail] Status check error:", error);
        res.status(500).json({ error: "Failed to check Gmail status" });
    }
};

/**
 * GET /gmail/config
 * Returns the Gmail OAuth client ID (needed by the extension to initiate OAuth flow).
 * The client secret is NOT exposed — it stays server-side only.
 */
export const gmailConfig = async (req: FirebaseAuthenticatedRequest, res: Response) => {
    try {
        if (!config.gmailClientId) {
            return res.status(500).json({ error: "Gmail OAuth is not configured" });
        }

        res.status(200).json({
            clientId: config.gmailClientId,
            scopes: GMAIL_SCOPES,
        });
    } catch (error: any) {
        console.error("[Gmail] Config error:", error);
        res.status(500).json({ error: "Failed to get Gmail config" });
    }
};
