import ChatPageWrapper from "@/components/chat-page-wrapper";
import { generateUUID } from "lib/utils";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const id = generateUUID();
  return <ChatPageWrapper threadId={id} key={id} />;
}
