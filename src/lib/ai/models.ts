// models.ts
// import { openai } from "@ai-sdk/openai";
import { LanguageModel } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

export const customModelProvider = {
  getModel: (): LanguageModel => {
    // TODO: use openrouter
    return anthropic("claude-4-sonnet-20250514");
  },
};
