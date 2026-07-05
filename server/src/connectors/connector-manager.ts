import { getConnectorIds } from "./registry.js";
import { isGmailConnected } from "../services/user.service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Connector Manager — determines which connectors a user has enabled.
//
// For each connector, checks if the user has valid auth credentials stored.
// This runs per-request to give the agent only the tools the user has access to.
// ─────────────────────────────────────────────────────────────────────────────

const CONNECTOR_CHECKS: Record<string, (userId: string) => Promise<boolean>> = {
    gmail: isGmailConnected,
    // github: isGitHubConnected,  ← add when you create GitHub connector
};

/**
 * Get the list of connected connector IDs for a user.
 */
export async function getUserConnectors(userId: string): Promise<string[]> {
    const connected: string[] = [];

    for (const connectorId of getConnectorIds()) {
        const check = CONNECTOR_CHECKS[connectorId];
        if (!check) continue;

        try {
            if (await check(userId)) {
                connected.push(connectorId);
            }
        } catch (err) {
            console.warn(`[ConnectorManager] Failed to check ${connectorId} for user ${userId}:`, err);
        }
    }

    if (connected.length > 0) {
        console.log(`[ConnectorManager] User ${userId} has connectors: ${connected.join(", ")}`);
    }

    return connected;
}
