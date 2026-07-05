/*
AstraDB uses a JSON/Document-based Data API, not SQL.
You don't need a SQL query to set up the collection.

Instead, you can create the vector collection either:
1. In the AstraDB UI (Dashboard)
2. By running this Node.js snippet once:
*/

/*
import { DataAPIClient } from "@datastax/astra-db-ts";

const client = new DataAPIClient("YOUR_ASTRA_TOKEN");
const db = client.db("YOUR_ASTRA_ENDPOINT");

async function setupAstraCollection() {
    try {
        await db.createCollection("screen_shot", {
            vector: {
                dimension: 1536, // because you are using OpenAI text-embedding-3-small
                metric: "cosine" // best for OpenAI embeddings
            }
        });
        
        await db.createCollection("subscription"); // Regular document collection for subscriptions
        
        console.log("AstraDB collections created successfully!");
    } catch (error) {
        console.error("Error creating collection:", error);
    }
}

setupAstraCollection();
*/
