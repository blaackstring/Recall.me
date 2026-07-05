import { listEmails, searchEmails, readEmail, sendEmail } from "../services/gmail-api.service.js";
import { isGmailConnected } from "../services/user.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Connector Tool Handlers — executes tool calls for each connector.
//
// Each handler: (userId, toolName, args) → result string
// Returns null if the connector is not connected for this user.
// ─────────────────────────────────────────────────────────────────────────────

type ToolHandler = (userId: string, args: Record<string, any>) => Promise<string>;

const gmailHandlers: Record<string, ToolHandler> = {
    gmail_list_emails: async (userId, args) => {
        const connected = await isGmailConnected(userId);
        if (!connected) return "Gmail is not connected. Tell the user to click the + button and connect Gmail first.";
        const emails = await listEmails(userId, args.max_results || 10);
        if (emails.length === 0) return "No emails found in inbox.";
        return JSON.stringify(emails, null, 2);
    },

    gmail_search_emails: async (userId, args) => {
        const connected = await isGmailConnected(userId);
        if (!connected) return "Gmail is not connected. Tell the user to click the + button and connect Gmail first.";
        const emails = await searchEmails(userId, args.query, args.max_results || 10);
        if (emails.length === 0) return `No emails found matching "${args.query}".`;
        return JSON.stringify(emails, null, 2);
    },

    gmail_read_email: async (userId, args) => {
        const connected = await isGmailConnected(userId);
        if (!connected) return "Gmail is not connected. Tell the user to click the + button and connect Gmail first.";
        const email = await readEmail(userId, args.message_id);
        return JSON.stringify(email, null, 2);
    },

    gmail_send_email: async (userId, args) => {
        const connected = await isGmailConnected(userId);
        if (!connected) return "Gmail is not connected. Tell the user to click the + button and connect Gmail first.";
        const result = await sendEmail(userId, args.to, args.subject, args.body);
        return `Email sent successfully to ${args.to}. Message ID: ${result.id}`;
    },
};

// ─── Handler registry ──────────────────────────────────────────────
const HANDLERS: Record<string, Record<string, ToolHandler>> = {
    gmail: gmailHandlers,
    // github: githubHandlers,  ← add when you create a GitHub connector
};

/**
 * Execute a connector tool call.
 * Returns the result string, or null if no handler found.
 */
export async function executeConnectorTool(
    connectorId: string,
    toolName: string,
    userId: string,
    args: Record<string, any>
): Promise<string | null> {
    const connectorHandlers = HANDLERS[connectorId];
    if (!connectorHandlers) return null;

    const handler = connectorHandlers[toolName];
    if (!handler) return null;

    try {
        return await handler(userId, args);
    } catch (err: any) {
        console.error(`[Connector:${connectorId}] Tool ${toolName} failed:`, err.message);
        return `Error executing ${toolName}: ${err.message}`;
    }
}
