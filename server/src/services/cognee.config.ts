import { init, Cognee } from "@cognee/cognee-ts";

const c = new Cognee();
c.config.setLlmModel("gpt-4o");
c.config.setLlmApiKey(process.env.OPENAI_TOKEN!);
c.config.setEmbeddingProvider("openai");
c.config.setEmbeddingModel("text-embedding-3-small");


// Read back the current config (secret fields are redacted):
export const cfg = c.config.get();
console.log(cfg);
