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
  const sharedBy = thread.userName || thread.userEmail;

  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-10 flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur-sm">
        <h1 className="text-lg font-semibold truncate pr-4">{thread.title}</h1>
        {sharedBy && (
          <div className="flex items-center gap-2 text-sm bg-muted text-muted-foreground px-3 py-1.5 rounded-full">
            <span>Shared by</span>
            <span className="font-semibold text-foreground truncate max-w-48">
              {sharedBy}
            </span>
          </div>
        )}
      </header>
      <div className="flex-1 overflow-y-auto">
        <ChatBot
          threadId={threadId}
          key={threadId}
          initialMessages={initialMessages}
          isReadOnly={true}
        />
      </div>
      <div className="sticky bottom-0 w-full border-t bg-transparent py-4 text-center backdrop-blur-sm">
        <Button asChild>
          <Link href="/">Start your own chat</Link>
        </Button>
      </div>
    </div>
  );
}
