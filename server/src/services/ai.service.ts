import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config.js";

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

export interface ScreenshotAnalysis {
    summary: string;
    tags: string[];
    category?: string;
}

export const analyzeImage = async (imageBuffer: Buffer, mimeType: string): Promise<ScreenshotAnalysis> => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
    Analyze this screenshot and provide:
    1. A short summary (2 lines).
    2. A list of 5-15 relevant tags.
    3. A category classification (e.g., Web Development, Social Media, Documentation, UI Design, etc.).

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
    const model = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const result = await model.embedContent({
        content: { parts: [{ text }], role: "user" },
        outputDimensionality: 768,
    });
    return result.embedding.values;
};
