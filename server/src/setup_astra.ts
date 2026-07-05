import { DataAPIClient } from "@datastax/astra-db-ts";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const client = new DataAPIClient(process.env.ASTRA_DB_TOKEN);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT as string);

async function setup() {
    try {
        console.log("Creating screen_shot collection...");
        await db.createCollection("screen_shot", {
            vector: {
                dimension: 768, // Gemini text-embedding dimension
                metric: "cosine"
            }
        });
        console.log("✅ screen_shot collection created.");

        console.log("Creating subscription collection...");
        await db.createCollection("subscription");
        console.log("✅ subscription collection created.");

        console.log("Done!");
    } catch (e: any) {
        if (e.message?.includes("already exists")) {
            console.log("Collections already exist. You are good to go!");
        } else {
            console.error("Error:", e);
        }
    }
}

setup();
