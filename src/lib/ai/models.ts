// models.ts
import { LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

export const customModelProvider = {
  getModel: (model?: string): LanguageModel => {
    if (model) {
      if (model.startsWith("openai/")) {
        return openai(model.replace("openai/", ""));
      }
      if (model.startsWith("anthropic/")) {
        return anthropic(model.replace("anthropic/", ""));
      }
    }
    return anthropic("claude-4-sonnet-20250514");
  },
  getTitleModel: (): LanguageModel => {
    return anthropic("claude-3-5-haiku-latest");
  },
};
