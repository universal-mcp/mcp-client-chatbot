import { getPublicThreadAction } from "@/app/api/chat/actions";
import ChatBot from "@/components/chat-bot";
import { Button } from "@/components/ui/button";
import { convertToUIMessage } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function SharedChatPage({
  params,
}: {
  params: Promise<{ thread: string }>;
}) {
  const { thread: threadId } = await params;
  const thread = await getPublicThreadAction(threadId);

  if (!thread) {
    notFound();
  }

  const initialMessages = thread.messages.map(convertToUIMessage);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <ChatBot
          threadId={threadId}
          key={threadId}
          initialMessages={initialMessages}
          isReadOnly={true}
        />
      </div>
      <div className="sticky bottom-0 w-full border-t bg-background py-4 text-center">
        <Button asChild>
          <Link href="/">Start your own chat</Link>
        </Button>
      </div>
    </div>
  );
}
