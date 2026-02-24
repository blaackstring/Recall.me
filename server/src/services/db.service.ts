import { createClient } from "@supabase/supabase-js";
import { config } from "../config.js";

const supabaseUrl = config.supabaseUrl;
const supabaseKey = config.supabaseKey;

export const supabase = createClient(supabaseUrl, supabaseKey);

export const saveScreenshot = async (data: {
    user_id: string;
    image_url: string;
    summary: string;
    tags: string[];
    embedding: number[];
}) => {
    const { data: result, error } = await supabase
        .from("screenshots")
        .insert([data]);

    if (error) {
        throw error;
    }
    return result;
};

export const searchScreenshots = async (user_id: string, queryEmbedding: number[], limit = 20) => {
    // We use Supabase RPC for vector search
    // Need to create this function in Supabase SQL editor first
    const { data, error } = await supabase.rpc("match_screenshots", {
        query_embedding: queryEmbedding,
        match_threshold: 0.5, // Lowered from 0.5 for better discovery
        match_count: limit,
        p_user_id: user_id
    });

    if (error) {
        throw error;
    }
    return data;
};
