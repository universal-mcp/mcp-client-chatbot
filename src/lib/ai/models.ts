// models.ts
import { openai } from "@ai-sdk/openai";
import { LanguageModel } from "ai";

export const customModelProvider = {
  getModel: (): LanguageModel => {
    return openai("gpt-4.1");
  },
};
