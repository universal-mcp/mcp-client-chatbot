"use client";

import {
  AudioWaveformIcon,
  CornerRightUp,
  Loader,
  Paperclip,
  Pause,
} from "lucide-react";
import { useRef, useEffect } from "react";
import { notImplementedToast } from "ui/shared-toast";
import { UseChatHelpers } from "@ai-sdk/react";
import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { ChatMessageAnnotation } from "app-types/chat";
import { ToolModeDropdown } from "./tool-mode-dropdown";
import { ToolSelectDropdown } from "./tool-select-dropdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import { useTranslations } from "next-intl";
import { cn } from "lib/utils";

interface PromptInputProps {
  placeholder?: string;
  setInput: (value: string) => void;
  input: string;
  onStop: () => void;
  append: UseChatHelpers["append"];
  toolDisabled?: boolean;
  isLoading?: boolean;
  voiceDisabled?: boolean;
  isInProjectContext?: boolean;
}

export default function PromptInput({
  placeholder,
  append,
  input,
  setInput,
  onStop,
  isLoading,
  toolDisabled,
  voiceDisabled,
  isInProjectContext,
}: PromptInputProps) {
  const t = useTranslations("Chat");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [
    currentThreadId,
    currentProjectId,
    appStoreMutate,
    isMcpClientListLoading,
  ] = appStore(
    useShallow((state) => [
      state.currentThreadId,
      state.currentProjectId,
      state.mutate,
      state.isMcpClientListLoading,
    ]),
  );

  const isLoadingTools =
    isMcpClientListLoading && !toolDisabled && !isInProjectContext;

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    // Don't focus if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest('[role="button"]') ||
      target.closest(".interactive-element")
    ) {
      return;
    }

    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const submit = () => {
    if (isLoading) return;
    const userMessage = input?.trim() || "";

    if (userMessage.length === 0) {
      return;
    }

    const annotations: ChatMessageAnnotation[] = [];

    setInput("");
    append!({
      role: "user",
      content: "",
      annotations,
      parts: [
        {
          type: "text",
          text: userMessage,
        },
      ],
    });
  };

  return (
    <div className="max-w-3xl mx-auto fade-in animate-in">
      <div className="z-10 mx-auto w-full max-w-3xl relative">
        <fieldset
          className="flex w-full min-w-0 max-w-full flex-col px-2"
          disabled={isLoadingTools}
        >
          <div
            onClick={handleContainerClick}
            className={cn(
              "rounded-4xl backdrop-blur-sm transition-all duration-200 bg-muted/80 relative flex w-full flex-col z-10 border items-stretch p-3",
              isLoadingTools
                ? "cursor-wait border-primary/50 animate-pulse"
                : "cursor-text focus-within:border-muted-foreground hover:border-muted-foreground",
            )}
          >
            <div className="flex flex-col gap-3.5 px-1">
              <div className="relative min-h-[2rem]">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={placeholder ?? t("placeholder")}
                  className="w-full resize-none border-none bg-transparent outline-none text-foreground placeholder:text-muted-foreground min-h-[2rem] max-h-[200px] overflow-y-auto leading-6 px-2 py-1 text-base placeholder:text-base"
                  rows={1}
                  disabled={isLoading || isLoadingTools}
                />
              </div>

              <div className="flex w-full items-center z-30 gap-1.5">
                <div
                  className="cursor-pointer text-muted-foreground border rounded-full p-2 bg-transparent hover:bg-muted transition-all duration-200 interactive-element"
                  onClick={notImplementedToast}
                >
                  <Paperclip className="size-4" />
                </div>

                {!toolDisabled && !isInProjectContext && (
                  <>
                    <div className="interactive-element">
                      <ToolModeDropdown />
                    </div>
                    <div className="interactive-element">
                      <ToolSelectDropdown align="start" side="top" />
                    </div>
                  </>
                )}
                <div className="flex-1" />

                {!isLoading && !input.length && !voiceDisabled ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        onClick={() => {
                          appStoreMutate((state) => ({
                            voiceChat: {
                              ...state.voiceChat,
                              isOpen: true,
                              threadId: currentThreadId ?? undefined,
                              projectId: currentProjectId ?? undefined,
                            },
                          }));
                        }}
                        className="border fade-in animate-in cursor-pointer text-background rounded-full p-2 bg-primary hover:bg-primary/90 transition-all duration-200 interactive-element"
                      >
                        <AudioWaveformIcon size={16} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>{t("VoiceChat.title")}</TooltipContent>
                  </Tooltip>
                ) : (
                  <div
                    onClick={() => {
                      if (isLoading) {
                        onStop();
                      } else {
                        submit();
                      }
                    }}
                    className="fade-in animate-in cursor-pointer text-muted-foreground rounded-full p-2 bg-secondary hover:bg-accent-foreground hover:text-accent transition-all duration-200 interactive-element"
                  >
                    {isLoading ? (
                      <Pause
                        size={16}
                        className="fill-muted-foreground text-muted-foreground"
                      />
                    ) : (
                      <CornerRightUp size={16} />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          {isLoadingTools && (
            <div className="mt-2 flex items-center justify-center text-xs text-muted-foreground">
              <Loader className="mr-2 size-3 animate-spin" />
              Waiting for tools to load...
            </div>
          )}
        </fieldset>
      </div>
    </div>
  );
}
