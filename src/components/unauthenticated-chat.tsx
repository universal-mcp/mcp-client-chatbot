"use client";

import { useState } from "react";
import UseCaseCards from "./landing-page/use-case-cards";
import { useRouter } from "next/navigation";
import PromptInput from "./prompt-input";
import type { UseChatHelpers } from "@ai-sdk/react";
import { ChatGreeting } from "./chat-greeting";
import { setPendingPrompt } from "lib/pending-prompt";

export default function UnauthenticatedChat() {
  const [input, setInput] = useState("");
  const router = useRouter();

  const appendRedirect: UseChatHelpers["append"] = async (message) => {
    const text = message.parts?.find((p) => p.type === "text")?.text?.trim();
    if (!text) return null;
    setPendingPrompt(text);
    router.push(`/sign-in`);
    return null;
  };

  return (
    <div className="flex flex-col min-w-0 relative h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full flex flex-col justify-center items-center pb-24">
          <div className="max-w-3xl mx-auto text-center w-full px-2">
            <ChatGreeting />
          </div>
          <div className="w-full my-4">
            <PromptInput
              input={input}
              setInput={setInput}
              append={appendRedirect}
              onStop={() => {}}
              isLoading={false}
              controlsDisabled
              isProjectSelectionDisabled
              projectList={[]}
            />
          </div>
          <div className="max-w-3xl mx-auto w-full px-2 pb-4">
            <UseCaseCards
              className="mt-0"
              onCardClick={(prompt) => setInput(prompt)}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
