// models.ts
import { LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { createAzure } from "@ai-sdk/azure";

const azure = createAzure({
  resourceName: "aihub2542374897",
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  apiVersion: "2024-12-01-preview",
});

export const customModelProvider = {
  getModel: (model?: string): LanguageModel => {
    if (model) {
      if (model.startsWith("openai/")) {
        return azure(model.replace("openai/", ""));
      }
      if (model.startsWith("anthropic/")) {
        return anthropic(model.replace("anthropic/", ""));
      }
    }
    return anthropic("claude-4-sonnet-20250514");
  },
  getTitleModel: (): LanguageModel => {
    return azure("gpt-4.1");
  },
};
