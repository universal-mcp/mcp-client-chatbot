import { chatRepository } from "lib/db/repository";
import { NextRequest } from "next/server";
import { generateTitleFromUserMessageAction } from "../actions";

import { customModelProvider } from "lib/ai/models";
import { getSessionContext } from "@/lib/auth/session-context";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { userId, organizationId } = await getSessionContext();
  const { threadId } = await params;
  const { messages, chatModel, projectId } = await request.json();

  let thread = await chatRepository.selectThread(
    threadId,
    userId,
    organizationId,
  );
  if (!thread) {
    const title = await generateTitleFromUserMessageAction({
      message: messages[0],
      model: customModelProvider.getModel(chatModel),
    });
    thread = await chatRepository.insertThread(
      {
        id: threadId,
        projectId: projectId ?? null,
        title,
        userId,
      },
      userId,
      organizationId,
    );
  }
  if (thread.userId !== userId) {
    return new Response("Forbidden", { status: 403 });
  }
  await chatRepository.insertMessages(
    messages.map((message) => ({
      ...message,
      threadId: thread.id,
      createdAt: message.createdAt ? new Date(message.createdAt) : undefined,
    })),
    userId,
    organizationId,
  );
  return new Response(
    JSON.stringify({
      success: true,
    }),
    {
      status: 200,
    },
  );
}
