import { DataAPIClient  } from "@datastax/astra-db-ts";
import { config } from "../config.js";

const client = new DataAPIClient(config.astraToken);

export const db = client.db(config.astraEndpoint);

export const collection = db.collection("screen_shot");
  
export const saveScreenshot = async (data:any) => {

    const result = await collection.insertOne({
        user_id: data.user_id,
        image_url: data.image_url,
        summary: data.summary,
        tags: data.tags,
        $vector: data.embedding,  // ✅ reserved field for vector search
        created_at: new Date()
    });

    return result;
};

export const searchScreenshots = async (user_id: any, queryEmbedding: any, limit = 20) => {


    const cursor = collection.find(
        { user_id },
        {
            sort: { $vector: queryEmbedding },
            limit: limit,
        }
    ).includeSimilarity(true);  

    const results = await cursor.toArray();

    const filtered = results.filter(r => (r.$similarity ?? 0) >= 0.5);
    return filtered;
};