// models.ts
import { LanguageModel } from "ai";
// import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

// const openrouter = createOpenRouter({
//   apiKey: process.env.OPENROUTER_API_KEY,
// });

export const customModelProvider = {
  getModel: (): LanguageModel => {
    // TODO: use openrouter
    return anthropic("claude-4-sonnet-20250514");
  },
  getTitleModel: (): LanguageModel => {
    return openai("gpt-4.1");
  },
};
