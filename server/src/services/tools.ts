import { tool } from "@langchain/core/tools";
import { z } from "zod";
import cogneeService, { screenshotSchema } from "./cognee.service.js";
// import { searchScreenshots } from "./db.service.js";   // DISABLED — using Cognee only
// import { generateEmbedding } from "./ai.service.js";    // DISABLED — using Cognee only
import type { RunnableConfig } from "@langchain/core/runnables";

// ─────────────────────────────────────────────────────────────────────────────
// Helper — read userId / sessionId from LangGraph's RunnableConfig.
// graph.invoke(state, { configurable: { userId, sessionId } }) passes these
// through automatically to every tool call via the config argument.
// ─────────────────────────────────────────────────────────────────────────────
const getUserId = (config?: RunnableConfig): string =>
  (config?.configurable?.userId as string) ?? "anonymous";

const getSessionId = (config?: RunnableConfig, userId?: string): string =>
  (config?.configurable?.sessionId as string) ?? `session-${userId ?? "anonymous"}`;

// ─────────────────────────────────────────────────────────────────────────────
// Tools — static exports, userId/sessionId come from config (not LLM args).
// ─────────────────────────────────────────────────────────────────────────────
export const recall_tool = tool(
  async ({ query }, config?: RunnableConfig) => {
    const userId = getUserId(config);
    const searchQuery = query?.trim() || "show all memories";
    console.log(`[Tool] recall_tool called for user ${userId} with query: "${searchQuery}"`);
    
    const svc = new cogneeService();
    try {
      let result = await svc.Recall(searchQuery, userId);
      console.log("[Tool] result ->", result);
      
      if (!result || (typeof result === 'string' && (result.includes("No results") || result.includes("not found")))) {
        return JSON.stringify([]);
      }
      
      return typeof result === "string" ? result : JSON.stringify(result ?? []);
    } catch (err: any) {
      console.error("[Tool] recall_tool error:", err.message);
      // Return empty array on failure instead of throwing
      return JSON.stringify([]);
    }
  },
  {
    name: "recall_tool",
    description: "Recall screenshots and memories from the database for the current user. Returns graph context including image URLs, summaries and tags.",
    schema: z.object({
      query: z.string().describe("The query to search for in the user's visual memory"),
    }),
  }
);

export const remember_tool = tool(
  async (data: z.infer<typeof screenshotSchema>, config?: RunnableConfig) => {
    const userId = getUserId(config);
    console.log(`[Tool] remember_tool called for user ${userId}`);
    const svc = new cogneeService();
    await svc.Remember(data, userId);
    return "Memory stored successfully.";
  },
  {
    name: "remember_tool",
    description: "Store a screenshot's metadata in the current user's memory.",
    schema: screenshotSchema,
  }
);

export const long_term_memory_query_tool = tool(
  async ({ query }, config?: RunnableConfig) => {
    const userId = getUserId(config);
    console.log(`[Tool] long_term_memory_query_tool called for user ${userId} with query: "${query}"`);
    const svc = new cogneeService();
    return await svc.LongTermMemoryQuery(query, userId);
  },
  {
    name: "long_term_memory_query_tool",
    description: "Store a long-term insight or memory for the current user.",
    schema: z.object({
      query: z.string().describe("The insight or memory to store long-term"),
    }),
  }
);

export const short_term_memory_query_tool = tool(
  async ({ query }, config?: RunnableConfig) => {
    const userId = getUserId(config);
    const sessionId = getSessionId(config, userId);
    console.log(`[Tool] short_term_memory_query_tool called for user ${userId}, session ${sessionId} with query: "${query}"`);
    const svc = new cogneeService();
    return await svc.ShortTermMemoryQuery(query, userId, sessionId);
  },
  {
    name: "short_term_memory_query_tool",
    description: "Store a short-term / session-scoped memory for the current user.",
    schema: z.object({
      query: z.string().describe("The short-term memory or context to store"),
    }),
  }
);

export const forget_memory_tool = tool(
  async ({ kind }, config?: RunnableConfig) => {
    const userId = getUserId(config);
    console.log(`[Tool] forget_memory_tool called for user ${userId} with kind: "${kind}"`);
    const svc = new cogneeService();
    return await svc.forgetMemory(kind, userId);
  },
  {
    name: "forget_memory_tool",
    description: "Delete memories from the current user's dataset.",
    schema: z.object({
      kind: z
        .enum(["item", "dataset", "all"])
        .describe("The scope of memory to delete (item, dataset, or all)"),
    }),
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// Router — checks if the last LLM message has tool calls.
// ─────────────────────────────────────────────────────────────────────────────
export const should_continue = async (state: any) => {
  try {
    const lastMessage = state?.messages?.[state?.messages?.length - 1];
    if (lastMessage?.tool_calls?.length) {
      for (const toolCall of lastMessage.tool_calls) {
        console.log("Tool ->", toolCall?.name);
      }
      return "tools";
    }
    console.log("No tool calls. Proceeding to structured output...");
    return "structuredOutput";
  } catch (error) {
    console.log("error ->", error);
    return "structuredOutput";
  }
};