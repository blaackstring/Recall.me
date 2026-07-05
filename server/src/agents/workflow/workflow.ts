import {
  StateSchema,
  MessagesValue,
  type GraphNode,
  StateGraph,
  START,
  END,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import * as z from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { AIMessage, ToolMessage } from "@langchain/core/messages";
import type { StructuredTool } from "@langchain/core/tools";
import { LLM_PROMPT_START } from "../prompts/prompts.js";
import {
  recall_tool,
  remember_tool,
  long_term_memory_query_tool,
  short_term_memory_query_tool,
  forget_memory_tool,
  should_continue,
} from "../../services/tools.js";
import { getUserConnectors } from "../../connectors/connector-manager.js";
import { getConnectorLangchainTools } from "../../connectors/tool-factory.js";

// ─────────────────────────────────────────────────────────────────────────────
// State
// ─────────────────────────────────────────────────────────────────────────────
const State = new StateSchema({
  messages: MessagesValue,
  query: z.string(),

  // Passed via graph.invoke — also forwarded as config.configurable to tools
  userId: z.string(),
  sessionId: z.string(),

  memories: z.array(z.string()),
  gmail: z.array(z.string()),
  notion: z.array(z.string()),
  browser_search: z.array(z.string()),
  photos: z.array(z.string()),

  structuredResponse: z
    .array(
      z.object({
        imageUrl: z.string().describe("URL or data-URI of the relevant image"),
        description: z.string().describe("Concise description of the image content"),
        tags: z.array(z.string()).describe("List of relevant tags for this image"),
      }),
    )
    .describe("Structured array of image-centric results with tool context"),

  answer: z.string(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Base tools — always available for every user
// ─────────────────────────────────────────────────────────────────────────────
const BASE_TOOLS = [
  recall_tool,
  remember_tool,
  long_term_memory_query_tool,
  short_term_memory_query_tool,
  forget_memory_tool,
];

const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0, apiKey: process.env.OPENAI_TOKEN || "" });

const structuredOutputSchema = z.object({
  results: z.array(
    z.object({
      imageUrl: z.string().describe("Exact URL or data-URI of the image"),
      description: z.string().describe("Short 1-2 sentence description of the image content"),
      tags: z.array(z.string()).describe("Relevant tags"),
    }),
  ).describe("Extract ONLY the visual image memories found in the tool results. If no images were found, return an empty array."),
});

const modelWithStructuredOutput = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0, apiKey: process.env.OPENAI_TOKEN || "" }).withStructuredOutput(structuredOutputSchema);

// ─────────────────────────────────────────────────────────────────────────────
// Main LLM node
// ─────────────────────────────────────────────────────────────────────────────
const buildMainLlm = (tools: StructuredTool[]): GraphNode<typeof State> => {
  const modelWithTools = model.bindTools(tools);
  const chain = LLM_PROMPT_START.pipe(modelWithTools);

  return async (state) => {
    console.log(`[Agent] Calling LLM (gpt-4o-mini) with ${state.messages.length} messages, ${tools.length} tools...`);
    const response = await chain.invoke({ messages: state.messages });

    if (response.tool_calls && response.tool_calls.length > 0) {
      console.log(`[Agent] LLM generated ${response.tool_calls.length} tool call(s):`, response.tool_calls.map(t => t.name));
    } else {
      console.log(`[Agent] LLM generated text response (no tool calls).`);
    }

    return { messages: [response] };
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Structured Output node — extracts images from tool results
// ─────────────────────────────────────────────────────────────────────────────
const structuredOutputNode: GraphNode<typeof State> = async (state) => {
  const toolCallsMade: { toolName: string; args: string }[] = [];
  const toolResults: string[] = [];

  for (const msg of state.messages) {
    if (msg instanceof AIMessage && msg.tool_calls) {
      for (const tc of msg.tool_calls) {
        toolCallsMade.push({ toolName: tc.name, args: JSON.stringify(tc.args) });
      }
    }
    if (msg instanceof ToolMessage) {
      toolResults.push(typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content));
    }
  }

  console.log(`[Agent] Fast-formatting final structured output for ${toolResults.length} tool results natively...`);

  // 1. Extract conversational answer from mainLlm
  const lastMessage = state.messages[state.messages.length - 1];
  let finalAnswer = "Here is what I found.";
  if (lastMessage && typeof lastMessage.content === "string" && lastMessage.content.trim().length > 0) {
      finalAnswer = lastMessage.content;
  }

  // 2. Parse tool results into structuredResponse
  const structuredResults: any[] = [];

  for (const resultStr of toolResults) {
    let foundImages = false;

    // Try to parse as direct JSON array (AstraDB fallback format)
    try {
      const parsedArr = JSON.parse(resultStr);
      if (Array.isArray(parsedArr)) {
        for (const item of parsedArr) {
          if (item.image_url || item.imageUrl) {
            structuredResults.push({
              imageUrl: item.image_url || item.imageUrl,
              description: item.summary || item.description || "Retrieved memory",
              tags: Array.isArray(item.tags) ? item.tags : []
            });
            foundImages = true;
          }
        }
      }
    } catch (e) {
      // Not a JSON array, proceed to regex
    }

    // Try to find JSON blocks embedded inside __node_content_start__ tags (Cognee format)
    if (!foundImages) {
      const contentRegex = /__node_content_start__\s*(\{[\s\S]*?\})\s*__node_content_end__/g;
      let match;
      while ((match = contentRegex.exec(resultStr)) !== null) {
        try {
          const parsedNode = JSON.parse(match[1]!);
          if (parsedNode.image_url || parsedNode.imageUrl) {
            structuredResults.push({
              imageUrl: parsedNode.image_url || parsedNode.imageUrl,
              description: parsedNode.summary || parsedNode.description || "Retrieved memory",
              tags: Array.isArray(parsedNode.tags) ? parsedNode.tags : []
            });
            foundImages = true;
          }
        } catch (e) {
          // Not a valid JSON block, skip
        }
      }
    }

    // Fallback: extract markdown images from finalAnswer
    if (!foundImages) {
      const markdownImageRegex = /!\[.*?\]\((https?:\/\/.*?)\)/g;
      let mdMatch;
      while ((mdMatch = markdownImageRegex.exec(finalAnswer)) !== null) {
        structuredResults.push({
          imageUrl: mdMatch[1],
          description: "Retrieved memory (from text)",
          tags: []
        });
      }
    }
  }

  // Deduplicate results based on imageUrl
  const uniqueResults = structuredResults.filter((value, index, self) =>
    index === self.findIndex((t) => t.imageUrl === value.imageUrl)
  );

  console.log(`[Agent] Natively extracted ${uniqueResults.length} images.`);

  return {
    structuredResponse: uniqueResults,
    answer: finalAnswer,
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Graph builder — compiles a new graph per-request with user-specific tools
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build a compiled LangGraph with base tools + user's connector tools.
 * Called per-request so each user only gets tools for their connected services.
 */
export async function buildGraph(userId: string) {
  // 1. Check which connectors the user has enabled
  const userConnectors = await getUserConnectors(userId);

  // 2. Get LangChain tools for enabled connectors
  const connectorTools = getConnectorLangchainTools(userConnectors);

  // 3. Merge base + connector tools
  const allTools = [...BASE_TOOLS, ...connectorTools];

  console.log(`[Agent] Building graph for user ${userId}: ${BASE_TOOLS.length} base + ${connectorTools.length} connector tools`);

  // 4. Build nodes with the full tool set
  const mainLlm = buildMainLlm(allTools);

  // 5. Compile graph
  const graph = new StateGraph(State)
    .addNode("mainLlm", mainLlm)
    .addNode("tools", new ToolNode(allTools))
    .addNode("structuredOutputNode", structuredOutputNode)
    .addEdge(START, "mainLlm")
    .addConditionalEdges("mainLlm", should_continue, {
      "tools": "tools",
      "structuredOutput": "structuredOutputNode",
    })
    .addEdge("tools", "mainLlm")
    .addEdge("structuredOutputNode", END)
    .compile();

  return graph;
}
