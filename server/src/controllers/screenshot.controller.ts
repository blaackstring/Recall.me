import type { Request, Response } from "express";
import { uploadToS3 } from "../services/s3.service.js";
import { analyzeImage, generateEmbedding } from "../services/ai.service.js";
import { saveScreenshot, searchScreenshots } from "../services/db.service.js";
import { v4 as uuidv4 } from "uuid";

export const processScreenshot = async (req: Request, res: Response) => {
    try {
        const file = req.file;
        const { userId } = req.body;

        if (!file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        if (!userId) {
            return res.status(400).json({ error: "User ID is required" });
        }

        const fileName = `${userId}_${Date.now()}_${uuidv4()}.png`;
        const mimeType = file.mimetype;

        // 1. Upload to S3
        const imageUrl = await uploadToS3(file.buffer, fileName, mimeType);

        // 2. AI Analysis (Vision)
        const analysis = await analyzeImage(file.buffer, mimeType);

        // 3. Generate Embedding (using summary and tags)
        const embeddingText = `${analysis.summary} ${analysis.tags.join(" ")}`;
        const embedding = await generateEmbedding(embeddingText);

        // 4. Save to Supabase
        await saveScreenshot({
            user_id: userId,
            image_url: imageUrl,
            summary: analysis.summary,
            tags: analysis.tags,
            embedding: embedding,
        });
        console.log(analysis);
        res.status(200).json({
            message: "Screenshot processed successfully",
            data: {
                imageUrl,
                analysis,
            },
        });
    } catch (error: any) {
        console.error("Error processing screenshot:", error);
        res.status(500).json({ error: error.message });
    }
};

export const handleSearch = async (req: Request, res: Response) => {
    try {
        const { query, userId } = req.body;
        console.log(`Search request: query="${query}", userId="${userId}"`);

        if (!query || !userId) {
            return res.status(400).json({ error: "Query and User ID are required" });
        }

        // 1. Generate embedding for search query
        const queryEmbedding = await generateEmbedding(query);
        console.log("Embedding generated for query");

        // 2. Search in Supabase
        const results = await searchScreenshots(userId, queryEmbedding);
        console.log(`Search results count: ${results?.length || 0}`);
     
        res.status(200).json({ results });
    } catch (error: any) {
        console.error("Error searching screenshots:", error);
        res.status(500).json({ error: error.message });
    }
};
