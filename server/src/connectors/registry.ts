import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Connector Registry — defines all available connectors and their tools.
//
// To add a new connector:
// 1. Add an entry here with tool definitions
// 2. Implement the tool execution in connector-handlers.ts
// 3. That's it — the agent auto-discovers tools from this registry
// ─────────────────────────────────────────────────────────────────────────────

export interface ConnectorToolDef {
    name: string;
    description: string;
    schema: z.ZodObject<any>;
}

export interface ConnectorDef {
    id: string;
    name: string;
    icon: string;
    description: string;
    authType: "oauth" | "token" | "api_key";
    tools: ConnectorToolDef[];
}

export const CONNECTORS: Record<string, ConnectorDef> = {
    gmail: {
        id: "gmail",
        name: "Gmail",
        icon: "mail",
        description: "Read, search, and send emails from the user's Gmail account",
        authType: "oauth",
        tools: [
            {
                name: "gmail_list_emails",
                description: "List the user's most recent emails from their Gmail inbox. Returns subject, sender, date, and snippet.",
                schema: z.object({
                    max_results: z.number().default(10).describe("Maximum number of emails to return (default 10)"),
                }),
            },
            {
                name: "gmail_search_emails",
                description: "Search emails using Gmail query syntax. Examples: 'from:john@', 'subject:meeting', 'is:unread', 'after:2024/01/01'.",
                schema: z.object({
                    query: z.string().describe("Gmail search query (e.g. 'from:john subject:meeting', 'is:unread')"),
                    max_results: z.number().default(10).describe("Maximum number of results (default 10)"),
                }),
            },
            {
                name: "gmail_read_email",
                description: "Read the full content of a specific email by its message ID.",
                schema: z.object({
                    message_id: z.string().describe("The Gmail message ID to read"),
                }),
            },
            {
                name: "gmail_send_email",
                description: "Send an email from the user's Gmail account. Requires recipient email, subject, and body.",
                schema: z.object({
                    to: z.string().describe("Recipient email address"),
                    subject: z.string().describe("Email subject line"),
                    body: z.string().describe("Email body text"),
                }),
            },
        ],
    },

    // ─── Add more connectors here ──────────────────────────────
    // github: {
    //     id: "github",
    //     name: "GitHub",
    //     icon: "github",
    //     description: "Search repos, read code, create issues",
    //     authType: "token",
    //     tools: [
    //         { name: "github_search_repos", ... },
    //         { name: "github_search_code", ... },
    //         { name: "github_create_issue", ... },
    //     ],
    // },
};

/**
 * Get all connector IDs.
 */
export function getConnectorIds(): string[] {
    return Object.keys(CONNECTORS);
}

/**
 * Get a connector definition by ID.
 */
export function getConnector(id: string): ConnectorDef | undefined {
    return CONNECTORS[id];
}

/**
 * Get all tool definitions for a list of connector IDs.
 */
export function getConnectorTools(connectorIds: string[]): ConnectorToolDef[] {
    const tools: ConnectorToolDef[] = [];
    for (const id of connectorIds) {
        const connector = CONNECTORS[id];
        if (connector) {
            tools.push(...connector.tools);
        }
    }
    return tools;
}
