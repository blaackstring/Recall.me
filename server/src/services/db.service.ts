import { DataAPIClient } from "@datastax/astra-db-ts";
import { config } from "../config.js";

const client = new DataAPIClient(config.astraToken);

export const db = client.db(config.astraEndpoint);

// ─── screen_shot collection — DISABLED (using Cognee memory layer instead) ──
// export const collection = db.collection("screen_shot");
export const subscriptionCollection = db.collection("subscription");

// ─── Plan limits ─────────────────────────────────────────────
export const PLAN_LIMITS: Record<string, number> = {
    free:     20,
    basic:    100,
    standard: 500,
    premium:  -1,  // -1 = unlimited
};

// ─── Get user's subscription ──────────────────────────────────
export const getUserSubscription = async (userId: string) => {
    return await subscriptionCollection.findOne({ user_id: userId });
};

// ─── Check if user can capture ────────────────────────────────
export const checkCaptureLimit = async (userId: string) => {
    const sub = await getUserSubscription(userId);
    const plan: string = (sub?.plan as string) || "free";
    const limit: number = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free!;

    if (limit === -1) {
        return { allowed: true, remaining: Infinity, plan, limit, used: 0 };
    }

    const used: number = (sub?.screenshots_used as number) ?? 0;
    const remaining = limit - used;

    return {
        allowed: remaining > 0,
        remaining,
        plan,
        used,
        limit,
    };
};

// ─── Increment usage after capture ───────────────────────────
export const incrementScreenshotUsage = async (userId: string) => {
    const existing = await getUserSubscription(userId);
    if (existing) {
        const currentUsed = (existing.screenshots_used as number) ?? 0;
        await subscriptionCollection.updateOne(
            { user_id: userId },
            { $set: { screenshots_used: currentUsed + 1, updated_at: new Date() } }
        );
    } else {
        // First capture — auto-create free plan record
        await subscriptionCollection.insertOne({
            user_id: userId,
            plan: "free",
            order_id: null,
            screenshots_limit: PLAN_LIMITS.free,
            screenshots_used: 1,
            subscribed_at: new Date(),
            updated_at: new Date(),
        });
    }
};

// ─── Activate paid subscription after payment ─────────────────
export const activateSubscription = async (userId: string, plan: string, orderId: string) => {
    const limit = PLAN_LIMITS[plan.toLowerCase()] ?? PLAN_LIMITS.free;
    const existing = await getUserSubscription(userId);

    if (existing) {
        await subscriptionCollection.updateOne(
            { user_id: userId },
            {
                $set: {
                    plan: plan.toLowerCase(),
                    order_id: orderId,
                    screenshots_limit: limit,
                    subscribed_at: new Date(),
                    updated_at: new Date(),
                }
            }
        );
    } else {
        await subscriptionCollection.insertOne({
            user_id: userId,
            plan: plan.toLowerCase(),
            order_id: orderId,
            screenshots_limit: limit,
            screenshots_used: 0,
            subscribed_at: new Date(),
            updated_at: new Date(),
        });
    }
};

// ─── Screenshot save — DISABLED (using Cognee memory layer instead) ──────
// export const saveScreenshot = async (data: any) => {
//     const result = await collection.insertOne({
//         user_id: data.user_id,
//         image_url: data.image_url,
//         summary: data.summary,
//         tags: data.tags,
//         $vector: data.embedding,
//         created_at: new Date()
//     });
//     return result;
// };

// ─── Screenshot search — DISABLED (using Cognee memory layer instead) ────
// export const searchScreenshots = async (user_id: any, queryEmbedding: any, limit = 20) => {
//     if (!queryEmbedding) {
//         const cursor = collection.find({ user_id }, { limit });
//         const rawResults = await cursor.toArray();
//         return rawResults.map(r => ({ ...r, id: r._id }));
//     }

//     const cursor = collection.find(
//         { user_id },
//         {
//             sort: { $vector: queryEmbedding },
//             limit: limit,
//         }
//     ).includeSimilarity(true);

//     const results = await cursor.toArray();
//     const filtered = results.filter(r => (r.$similarity ?? 0) >= 0.5);
//     return filtered.map(r => ({ ...r, id: r._id }));
// };