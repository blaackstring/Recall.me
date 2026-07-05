import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { StructuredTool } from "@langchain/core/tools";
import type { RunnableConfig } from "@langchain/core/runnables";
import { CONNECTORS, type ConnectorToolDef } from "./registry.js";
import { executeConnectorTool } from "./connector-handlers.js";

// ─────────────────────────────────────────────────────────────────────────────
// Tool Factory — converts connector tool definitions → LangChain StructuredTools.
//
// Each tool is a dynamic proxy that:
// 1. Reads userId from LangGraph's config (same pattern as existing tools)
// 2. Finds which connector owns this tool
// 3. Calls the connector handler at runtime
// ─────────────────────────────────────────────────────────────────────────────

const getUserId = (config?: RunnableConfig): string =>
    (config?.configurable?.userId as string) ?? "anonymous";

// Map toolName → connectorId (built once at startup)
const toolToConnector: Record<string, string> = {};

for (const [connectorId, connector] of Object.entries(CONNECTORS)) {
    for (const toolDef of connector.tools) {
        toolToConnector[toolDef.name] = connectorId;
    }
}

/**
 * Create a LangChain StructuredTool from a connector tool definition.
 */
function createConnectorTool(toolDef: ConnectorToolDef): StructuredTool {
    return tool(
        async (args: Record<string, any>, config?: RunnableConfig) => {
            const userId = getUserId(config);
            const connectorId = toolToConnector[toolDef.name] ?? "unknown";

            console.log(`[Connector] EXECUTING ${toolDef.name} for user ${userId} (connector: ${connectorId})`);
            console.log(`[Connector] Args:`, JSON.stringify(args));

            const result = await executeConnectorTool(connectorId, toolDef.name, userId, args);
            console.log(`[Connector] ${toolDef.name} result length: ${result?.length ?? 0}`);
            return result ?? `Unknown tool: ${toolDef.name}`;
        },
        {
            name: toolDef.name,
            description: toolDef.description,
            schema: toolDef.schema,
        }
    );
}

/**
 * Get all connector tools as LangChain StructuredTools for a set of connector IDs.
 */
export function getConnectorLangchainTools(connectorIds: string[]): StructuredTool[] {
    const tools: StructuredTool[] = [];

    for (const connectorId of connectorIds) {
        const connector = CONNECTORS[connectorId];
        if (!connector) continue;

        for (const toolDef of connector.tools) {
            tools.push(createConnectorTool(toolDef));
        }
    }

    if (tools.length > 0) {
        console.log(`[ToolFactory] Created ${tools.length} connector tools for: ${connectorIds.join(", ")}`);
    }

    return tools;
}

/**
 * Get ALL available connector tool names (for prompt generation).
 */
export function getAllConnectorToolNames(): string[] {
    return Object.keys(toolToConnector);
}
