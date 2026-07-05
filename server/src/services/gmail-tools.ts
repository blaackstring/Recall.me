import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { listEmails, searchEmails, readEmail, sendEmail } from "./gmail-api.service.js";
import { isGmailConnected } from "./user.service.js";
import type { RunnableConfig } from "@langchain/core/runnables";

const getUserId = (config?: RunnableConfig): string =>
  (config?.configurable?.userId as string) ?? "anonymous";

// ─── gmail_list_emails ──────────────────────────────────────────
export const gmail_list_emails = tool(
  async ({ max_results }, config?: RunnableConfig) => {
    const userId = getUserId(config);
    console.log(`[Tool] gmail_list_emails called for user ${userId}`);

    const connected = await isGmailConnected(userId);
    if (!connected) return "Gmail is not connected. Tell the user to click the + button and connect Gmail first.";

    try {
      const emails = await listEmails(userId, max_results);
      if (emails.length === 0) return "No emails found in inbox.";
      return JSON.stringify(emails, null, 2);
    } catch (err: any) {
      return `Error reading emails: ${err.message}`;
    }
  },
  {
    name: "gmail_list_emails",
    description: "List the user's most recent emails from their Gmail inbox. Returns subject, sender, date, and snippet.",
    schema: z.object({
      max_results: z.number().default(10).describe("Maximum number of emails to return (default 10)"),
    }),
  }
);

// ─── gmail_search_emails ────────────────────────────────────────
export const gmail_search_emails = tool(
  async ({ query, max_results }, config?: RunnableConfig) => {
    const userId = getUserId(config);
    console.log(`[Tool] gmail_search_emails called for user ${userId} with query: "${query}"`);

    const connected = await isGmailConnected(userId);
    if (!connected) return "Gmail is not connected. Tell the user to click the + button and connect Gmail first.";

    try {
      const emails = await searchEmails(userId, query, max_results);
      if (emails.length === 0) return `No emails found matching "${query}".`;
      return JSON.stringify(emails, null, 2);
    } catch (err: any) {
      return `Error searching emails: ${err.message}`;
    }
  },
  {
    name: "gmail_search_emails",
    description: "Search emails using Gmail query syntax. Examples: 'from:john@', 'subject:meeting', 'is:unread', 'after:2024/01/01', 'label:important'.",
    schema: z.object({
      query: z.string().describe("Gmail search query (e.g. 'from:john subject:meeting', 'is:unread', 'after:2024/06/01')"),
      max_results: z.number().default(10).describe("Maximum number of results (default 10)"),
    }),
  }
);

// ─── gmail_read_email ───────────────────────────────────────────
export const gmail_read_email = tool(
  async ({ message_id }, config?: RunnableConfig) => {
    const userId = getUserId(config);
    console.log(`[Tool] gmail_read_email called for user ${userId}, message: ${message_id}`);

    const connected = await isGmailConnected(userId);
    if (!connected) return "Gmail is not connected. Tell the user to click the + button and connect Gmail first.";

    try {
      const email = await readEmail(userId, message_id);
      return JSON.stringify(email, null, 2);
    } catch (err: any) {
      return `Error reading email: ${err.message}`;
    }
  },
  {
    name: "gmail_read_email",
    description: "Read the full content of a specific email by its message ID.",
    schema: z.object({
      message_id: z.string().describe("The Gmail message ID to read"),
    }),
  }
);

// ─── gmail_send_email ───────────────────────────────────────────
export const gmail_send_email = tool(
  async ({ to, subject, body }, config?: RunnableConfig) => {
    const userId = getUserId(config);
    console.log(`[Tool] gmail_send_email called for user ${userId}: to=${to}, subject=${subject}`);

    const connected = await isGmailConnected(userId);
    if (!connected) return "Gmail is not connected. Tell the user to click the + button and connect Gmail first.";

    try {
      const result = await sendEmail(userId, to, subject, body);
      return `Email sent successfully to ${to}. Message ID: ${result.id}`;
    } catch (err: any) {
      return `Error sending email: ${err.message}`;
    }
  },
  {
    name: "gmail_send_email",
    description: "Send an email from the user's Gmail account. Requires recipient email, subject, and body.",
    schema: z.object({
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Email body text"),
    }),
  }
);
