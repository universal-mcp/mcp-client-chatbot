import ChatBot from "@/components/chat-bot";
import { generateUUID } from "lib/utils";

export const dynamic = "force-dynamic";

export default function ChatHomePage() {
  const id = generateUUID();
  return <ChatBot threadId={id} initialMessages={[]} key={id} />;
}
