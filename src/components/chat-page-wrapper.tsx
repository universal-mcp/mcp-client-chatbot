"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import ChatBot from "./chat-bot";

interface ChatPageWrapperProps {
  threadId: string;
}

export default function ChatPageWrapper({ threadId }: ChatPageWrapperProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialPrompt = searchParams.get("prompt");
  const hasProcessedPrompt = useRef(false);

  useEffect(() => {
    if (initialPrompt && !hasProcessedPrompt.current) {
      hasProcessedPrompt.current = true;

      // Clear the search params after processing
      const timer = setTimeout(() => {
        router.replace("/", { scroll: false });
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [initialPrompt, router]);

  // Convert initial prompt to message format if present
  const initialMessages =
    initialPrompt && !hasProcessedPrompt.current ? [] : [];

  return (
    <ChatBot
      initialMessages={initialMessages}
      threadId={threadId}
      key={`${threadId}-${initialPrompt ? "with-prompt" : "empty"}`}
      slots={{
        emptySlot: initialPrompt ? (
          <AutoSubmitPrompt prompt={initialPrompt} />
        ) : undefined,
      }}
    />
  );
}

function AutoSubmitPrompt({ prompt }: { prompt: string }) {
  useEffect(() => {
    console.log("AutoSubmitPrompt mounted with prompt:", prompt);
    // Use a longer delay to ensure the ChatBot component is fully mounted and ready
    const timer = setTimeout(() => {
      console.log("Dispatching autoSubmitPrompt event...");
      // Dispatch a custom event that the ChatBot can listen for
      window.dispatchEvent(
        new CustomEvent("autoSubmitPrompt", {
          detail: { prompt },
        }),
      );
    }, 500);

    return () => clearTimeout(timer);
  }, [prompt]);

  return null;
}
