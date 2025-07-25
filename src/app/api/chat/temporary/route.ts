import { getSessionContext } from "@/lib/auth/session-context";
import { Message, smoothStream, streamText } from "ai";
import { customModelProvider } from "lib/ai/models";
import logger from "logger";
import { buildUserSystemPrompt } from "lib/ai/prompts";
import { userRepository } from "lib/db/repository";
import { redirect } from "next/navigation";

export async function POST(request: Request) {
  try {
    const json = await request.json();

    const { userId, user } = await getSessionContext();

    if (!userId) {
      return redirect("/sign-in");
    }

    const { messages, instructions } = json as {
      messages: Message[];
      instructions?: string;
    };
    const model = customModelProvider.getModel(undefined);
    const userPreferences =
      (await userRepository.getPreferences(userId)) || undefined;

    return streamText({
      model,
      system: `${buildUserSystemPrompt(user, userPreferences)} ${
        instructions ? `\n\n${instructions}` : ""
      }`.trim(),
      messages,
      maxSteps: 10,
      experimental_continueSteps: true,
      experimental_transform: smoothStream({ chunking: "word" }),
    }).toDataStreamResponse();
  } catch (error: any) {
    logger.error(error);
    return new Response(error.message || "Oops, an error occured!", {
      status: 500,
    });
  }
}
