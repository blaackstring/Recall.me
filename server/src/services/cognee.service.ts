import * as z from 'zod';
import FormData from 'form-data';


const COGNEE_API_BASE = 'https://tenant-0cc13d6c-c3c4-4056-a339-5bbc5613505b.aws.cognee.ai/api/v1';
const API_KEY = process.env.COGNEE_API_KEY!;

export const screenshotSchema = z.object({
    user_id: z.string(),
    image_url: z.string(),
    summary: z.string(),
    tags: z.array(z.string()),
    created_at: z.string().describe("ISO date string of when the screenshot was created"),
});

const validateSchema = (data: any) => {
    const result = screenshotSchema.safeParse(data);
    if (!result.success) throw new Error(result.error.message);
    return result.data;
};

const cogneeGet = (path: string) =>
    fetch(`${COGNEE_API_BASE}${path}`, {
        headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
    });

const cogneePost = (path: string, body: object) =>
    fetch(`${COGNEE_API_BASE}${path}`, {
        method: 'POST',
        headers: { 'X-Api-Key': API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

/**
 * Helper: send a FormData multipart body via fetch.
 * The `form-data` npm package can't be passed directly to fetch — we use getBuffer()
 * to get the raw multipart bytes and set the correct Content-Type with boundary.
 */
const cogneeMultipartPost = async (path: string, form: FormData) => {
    const buffer = form.getBuffer();
    return fetch(`${COGNEE_API_BASE}${path}`, {
        method: 'POST',
        headers: {
            'X-Api-Key': API_KEY,
            ...form.getHeaders(),
        },
        body: buffer as any,
    });
};

/**
 * Each user gets their own isolated Cognee dataset: "user-<userId>"
 * This ensures one user's memories never leak into another user's recalls.
 */
export default class cogneeService {

    /** Store a screenshot's metadata in the user's own Cognee dataset. */
    Remember = async (data: z.infer<typeof screenshotSchema>, userId: string) => {
        try {
            const dataset = `user-${userId}`;
            const text = validateSchema(data);

            const form = new FormData();
            form.append('data', Buffer.from(JSON.stringify(text), 'utf-8'), {
                filename: 'memory.txt',
                contentType: 'text/plain',
            });
            form.append('datasetName', dataset);
            form.append('run_in_background', 'true');

            const res = await cogneeMultipartPost('/remember', form);

            if (!res.ok) throw new Error(`Remember failed (${res.status}): ${await res.text()}`);
            console.log(`[Cognee Cloud] Stored memory for user ${userId} in dataset "${dataset}"`);
        } catch (error) {
            console.error("Failed to remember:", error);
        }
    };

    /** Recall memories using semantic graph search. */
    Recall = async (query: string, userId: string) => {
        try {
            const dataset = `user-${userId}`;
            const res = await cogneePost('/search', {
                query,
                datasets: [dataset],
                search_type: "GRAPH_COMPLETION",
                only_context: true
            });
            if (!res.ok) {
                if (res.status === 404) {
                    console.warn(`[Cognee] Dataset for user ${userId} not found or not yet indexed (404).`);
                    return undefined;
                }
                if (res.status === 422) {
                    console.warn(`[Cognee] No data for user ${userId} yet - capture a screenshot first (422).`);
                    return "No memories found. Capture a screenshot first to start building your memory.";
                }
                throw new Error(`Recall failed (${res.status}): ${await res.text()}`);
            }
            return await res.json();
        } catch (error: any) {
            console.warn("[Cognee] Failed to recall:", error.message || error);
        }
    };

    /** Store a long-term insight. */
    LongTermMemoryQuery = async (query: string, userId: string) => {
        try {
            const dataset = `user-${userId}`;
            const form = new FormData();
            form.append('data', Buffer.from(query, 'utf-8'), { filename: 'memory.txt', contentType: 'text/plain' });
            form.append('datasetName', dataset);

            const res = await cogneeMultipartPost('/remember', form);
            if (!res.ok) throw new Error(`LTM failed: ${await res.text()}`);
            return "ok";
        } catch (error) {
            console.error("Failed to store long term memory:", error);
        }
    };

    /** Store a short-term / session-scoped memory. */
    ShortTermMemoryQuery = async (query: string, userId: string, sessionId?: string) => {
        try {
            const form = new FormData();
            form.append('data', Buffer.from(query, 'utf-8'), { filename: 'memory.txt', contentType: 'text/plain' });
            form.append('datasetName', `user-${userId}`);
            form.append('session_id', sessionId ?? `session-${userId}`);

            const res = await cogneeMultipartPost('/remember', form);
            if (!res.ok) throw new Error(`STM failed: ${await res.text()}`);
        } catch (error) {
            console.error("Failed to store short term memory:", error);
        }
    };

    /** Forget memories from the user's dataset. */
    forgetMemory = async (kind: string, userId: string) => {
        try {
            const res = await cogneePost('/forget', {
                datasetName: kind === 'all' ? undefined : `user-${userId}`,
            });
            if (!res.ok) throw new Error(`Forget failed: ${await res.text()}`);
            return await res.json();
        } catch (error) {
            console.error("Failed to forget:", error);
            return error;
        }
    };

    /** Visualize the user's graph via Cognee Cloud API */
    visualizeGraph = async (userId?: string) => {
        try {
            let datasetId: string | undefined;
            if (userId) {
                const datasetName = `user-${userId}`;
                const datasetsRes = await cogneeGet('/datasets');
                if (datasetsRes.ok) {
                    const datasets = await datasetsRes.json();
                    const dataset = datasets.find((d: any) => d.name === datasetName);
                    if (dataset) {
                        datasetId = dataset.id;
                    }
                }
            }

            const url = datasetId
                ? `/visualize?dataset_id=${encodeURIComponent(datasetId)}`
                : '/visualize';
            const res = await cogneeGet(url);
            if (!res.ok) throw new Error(`Visualize failed: ${await res.text()}`);
            return await res.text();
        } catch (error) {
            console.error("Failed to visualize:", error);
            return { error: String(error) };
        }
    };
}
