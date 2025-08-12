// models.ts
import { LanguageModel } from "ai";
// import { openai } from "@ai-sdk/openai";
// import { anthropic } from "@ai-sdk/anthropic";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";

const bedrock = createAmazonBedrock({
  region: process.env.AWS_REGION!,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
});

export const customModelProvider = {
  getModel: (_model?: string): LanguageModel => {
    return bedrock("apac.anthropic.claude-sonnet-4-20250514-v1:0");
  },
  getTitleModel: (): LanguageModel => {
    return bedrock("apac.anthropic.claude-3-5-sonnet-20240620-v1:0");
  },
};
