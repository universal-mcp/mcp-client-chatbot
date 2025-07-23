// models.ts
import { LanguageModel } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const customModelProvider = {
  getModel: (): LanguageModel => {
    // TODO: use openrouter
    return openrouter("anthropic/claude-sonnet-4");
  },
};
