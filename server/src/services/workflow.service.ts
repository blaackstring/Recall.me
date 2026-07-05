import { StateSchema, MessagesValue, type GraphNode, StateGraph, START, END } from "@langchain/langgraph";
import * as z from 'zod';
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { LLM_PROMPT_START } from "../agents/prompts/prompts.js";
const State = new StateSchema({
    //chat history
  messages: MessagesValue,
query: z.string(),

  // Logged-in user
  userId: z.string(),

  // Retrieved memories from Cognee
  memories: z.array(z.string()),

  // Results from tools
  gmail: z.array(z.string()),
  notion: z.array(z.string()),
  browser_search: z.array(z.string()),
  photos: z.array(z.string()),

  // Final response
  answer: z.string()
});



const model = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-pro",
  temperature: 0,
});

const mainLlm: GraphNode<typeof State> = async (state) => {
  const chain = LLM_PROMPT_START.pipe(model);
  const response = await chain.invoke({
    messages: state.messages,
  });

  return { messages: [response] };
};
const graph = new StateGraph(State)
  .addNode("mainLlm", mainLlm)
  .addEdge(START, "mainLlm")
  .addEdge("mainLlm", END)
  .compile();

await graph.invoke({ messages: [{ role: "user", content: "hi!" }] });