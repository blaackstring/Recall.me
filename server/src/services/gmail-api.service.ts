import { google, type gmail_v1 } from "googleapis";
import { config } from "../config.js";
import { getGmailTokens, saveGmailTokens, type GmailTokens } from "./user.service.js";

/**
 * Create an OAuth2 client with the user's stored tokens.
 * Automatically refreshes the access token if expired.
 */
async function getGmailClient(uid: string): Promise<gmail_v1.Gmail | null> {
    const tokens = await getGmailTokens(uid);
    if (!tokens) return null;

    const oauth2Client = new google.auth.OAuth2(
        config.gmailClientId,
        config.gmailClientSecret,
    );

    oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
    });

    // Listen for token refresh events and save the new tokens
    oauth2Client.on("tokens", async (newTokens) => {
        if (newTokens.access_token) {
            console.log("[Gmail] Access token refreshed for user", uid);
            await saveGmailTokens(uid, {
                ...tokens,
                access_token: newTokens.access_token,
                expiry_date: newTokens.expiry_date || Date.now() + 3600 * 1000,
            });
        }
    });

    return google.gmail({ version: "v1", auth: oauth2Client });
}

/**
 * List recent emails from the user's Gmail inbox.
 */
export async function listEmails(uid: string, maxResults: number = 10): Promise<any[]> {
    const gmail = await getGmailClient(uid);
    if (!gmail) throw new Error("Gmail not connected");

    const res = await gmail.users.messages.list({
        userId: "me",
        maxResults,
    });

    const messages = res.data.messages || [];
    if (messages.length === 0) return [];

    // Fetch full details for each message
    const emails = await Promise.all(
        messages.map(async (msg) => {
            if (!msg.id) return null;
            const full = await gmail.users.messages.get({
                userId: "me",
                id: msg.id,
                format: "metadata",
                metadataHeaders: ["From", "To", "Subject", "Date"],
            });

            const headers = full.data.payload?.headers || [];
            const getHeader = (name: string) =>
                headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

            return {
                id: msg.id,
                subject: getHeader("Subject"),
                from: getHeader("From"),
                date: getHeader("Date"),
                snippet: full.data.snippet || "",
            };
        })
    );

    return emails.filter(Boolean);
}

/**
 * Search emails using Gmail query syntax.
 * Examples: "from:john", "subject:meeting", "is:unread", "after:2024/01/01"
 */
export async function searchEmails(uid: string, query: string, maxResults: number = 10): Promise<any[]> {
    const gmail = await getGmailClient(uid);
    if (!gmail) throw new Error("Gmail not connected");

    const res = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults,
    });

    const messages = res.data.messages || [];
    if (messages.length === 0) return [];

    const emails = await Promise.all(
        messages.map(async (msg) => {
            if (!msg.id) return null;
            const full = await gmail.users.messages.get({
                userId: "me",
                id: msg.id,
                format: "metadata",
                metadataHeaders: ["From", "To", "Subject", "Date"],
            });

            const headers = full.data.payload?.headers || [];
            const getHeader = (name: string) =>
                headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

            return {
                id: msg.id,
                subject: getHeader("Subject"),
                from: getHeader("From"),
                date: getHeader("Date"),
                snippet: full.data.snippet || "",
            };
        })
    );

    return emails.filter(Boolean);
}

/**
 * Read a single email by its ID. Returns full body.
 */
export async function readEmail(uid: string, messageId: string): Promise<any> {
    const gmail = await getGmailClient(uid);
    if (!gmail) throw new Error("Gmail not connected");

    const full = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
    });

    const headers = full.data.payload?.headers || [];
    const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

    // Extract body
    let body = "";
    const extractBody = (part: any): string => {
        if (part.body?.data) {
            return Buffer.from(part.body.data, "base64url").toString("utf-8");
        }
        if (part.parts) {
            for (const p of part.parts) {
                const text = extractBody(p);
                if (text) return text;
            }
        }
        return "";
    };

    body = extractBody(full.data.payload);

    return {
        id: messageId,
        subject: getHeader("Subject"),
        from: getHeader("From"),
        to: getHeader("To"),
        date: getHeader("Date"),
        snippet: full.data.snippet || "",
        body: body.substring(0, 3000), // Limit body length
    };
}

/**
 * Send an email.
 */
export async function sendEmail(
    uid: string,
    to: string,
    subject: string,
    body: string
): Promise<{ id: string; threadId: string | null }> {
    const gmail = await getGmailClient(uid);
    if (!gmail) throw new Error("Gmail not connected");

    const emailLines = [
        `To: ${to}`,
        `Subject: ${subject}`,
        "Content-Type: text/plain; charset=utf-8",
        "",
        body,
    ];

    const raw = Buffer.from(emailLines.join("\r\n")).toString("base64url");

    const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: {
            raw,
        },
    });

    return {
        id: res.data.id || "",
        threadId: res.data.threadId || null,
    };
}
