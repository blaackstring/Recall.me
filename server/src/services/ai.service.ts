import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";
import { ChatOpenAI } from "@langchain/openai";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

import { OpenAIEmbeddings } from "@langchain/openai";

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_TOKEN,
  batchSize: 512,
  model: "text-embedding-3-small",
  dimensions: 768
});

export interface ScreenshotAnalysis {
    summary: string;
    tags: string[];
    category?: string;
}

export const analyzeImage = async (imageBuffer: Buffer, mimeType: string): Promise<ScreenshotAnalysis> => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
    Analyze this screenshot in EXTREME detail. Your goal is to make it highly searchable for a user later.
    
    1. SUMMARY (3-5 sentences): Describe the visual context, but MUST explicitly extract and include:
       - Any exact Email Addresses, Phone Numbers, or contact details.
       - Specific YouTube channel names, video titles, or user handles (e.g. @username).
       - Prominent text, brands, product names, error messages, or code snippets visible on screen.
       - If it's a social media/video page, include the creator's name and exact topic.
       
    2. TAGS (10-20 tags): 
       - Include specific entities (e.g., "React", "Hostinger", "John Doe").
       - Include data types present (e.g., "phone number", "email", "invoice", "code").
       - Include broad categories (e.g., "Web Development", "Entertainment").

    3. CATEGORY: A single broad classification (e.g., Social Media, Development, Finance, Communication).

    Return the result strictly as a JSON object with the following structure:
    {
      "summary": "...",
      "tags": ["...", "..."],
      "category": "..."
    }
  `;

    const imageParts = [
        {
            inlineData: {
                data: imageBuffer.toString("base64"),
                mimeType,
            },
        },
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    // Basic JSON extraction in case Gemini wraps it in triple backticks
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error("Failed to parse AI response as JSON");
    }

    return JSON.parse(jsonMatch[0]);
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
    // const model = genAI.getGenerativeModel({ model: "gemini-embedding-2", });
    // const result = await model.embedContent({
    //     content: { parts: [{ text }], role: "user" },
    //         outputDimensionality: 768,

    // });

    const result=await embeddings.embedQuery(text);
    return result;
};
