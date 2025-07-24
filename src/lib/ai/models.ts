// models.ts
import { LanguageModel } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { openai } from "@ai-sdk/openai";

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const customModelProvider = {
  getModel: (model: string | undefined): LanguageModel => {
    if (!model) {
      return openrouter("anthropic/claude-sonnet-4");
    }
    // TODO: use openrouter
    return openrouter(model);
  },
  getTitleModel: (): LanguageModel => {
    return openai("gpt-4.1");
  },
};
