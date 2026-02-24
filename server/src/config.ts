import dotenv from "dotenv";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Try loading from current dir and root dir
dotenv.config({ path: resolve(__dirname, ".env") });
dotenv.config({ path: resolve(__dirname, "../.env") });
dotenv.config(); // Default to current working directory

export const config = {
    port: process.env.PORT || 3001,
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseKey: process.env.SUPABASE_ANON_KEY || "",
    awsRegion: process.env.AWS_REGION || "us-east-1",
    awsAccessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    awsSecretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    awsBucketName: process.env.AWS_S3_BUCKET_NAME || "",
    geminiApiKey: process.env.GEMINI_API_KEY || "",
    cloudfrontUrl: process.env.CLOUDFRONT_URL || "",
};

// Validation
if (!config.supabaseUrl || !config.supabaseKey) {
    console.warn("WARNING: Supabase URL or Anon Key is missing in .env");
}
