import { selectThreadWithMessagesAction } from "@/app/api/chat/actions";
import ChatBot from "@/components/chat-bot";

import { ChatMessage, ChatThread } from "app-types/chat";
import { convertToUIMessage } from "lib/utils";
import { redirect } from "next/navigation";

const fetchThread = async (
  threadId: string,
): Promise<(ChatThread & { messages: ChatMessage[] }) | null> => {
  const response = await selectThreadWithMessagesAction(threadId);
  if (!response) return null;
  return response;
};

export default async function Page({
  params,
}: { params: Promise<{ thread: string }> }) {
  const { thread: threadId } = await params;

  const thread = await fetchThread(threadId);

  if (!thread) redirect("/");

  const initialMessages = thread.messages.map(convertToUIMessage);

  return (
    <ChatBot
      threadId={threadId}
      key={threadId}
      initialMessages={initialMessages}
    />
  );
}
