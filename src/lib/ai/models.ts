// models.ts
import { LanguageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

export const customModelProvider = {
  getModel: (): LanguageModel => {
    return anthropic("claude-4-sonnet-20250514");
  },
  getTitleModel: (): LanguageModel => {
    return openai("gpt-4.1");
  },
};
