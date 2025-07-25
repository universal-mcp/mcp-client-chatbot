"use client";

import {
  AudioWaveformIcon,
  CornerRightUp,
  Paperclip,
  Square,
  X,
} from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { UseChatHelpers } from "@ai-sdk/react";
import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { ChatMessageAnnotation } from "app-types/chat";
import { ToolModeDropdown } from "./tool-mode-dropdown";
import { ToolSelectDropdown } from "./tool-select-dropdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import { useTranslations } from "next-intl";
import { cn } from "lib/utils";
import { Button } from "ui/button";
import { notImplementedToast } from "ui/shared-toast";

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
  disabled?: boolean;
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
  disabled,
}: PromptInputProps) {
  const t = useTranslations("Chat");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<
    { name: string; content: string }[]
  >([]);

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

  const isLoadingTools = isMcpClientListLoading && !toolDisabled;

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

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = () => {
    if (isLoading || disabled) return;
    const userMessage = input?.trim() || "";

    if (userMessage.length === 0 && attachedFiles.length === 0) {
      return;
    }

    let finalMessage = userMessage;
    const annotations: ChatMessageAnnotation[] = [];
    if (attachedFiles.length > 0) {
      let filePreamble = "";
      attachedFiles.forEach((file) => {
        filePreamble += `"""The user attached the file \`${file.name}\`. Its contents are:\n\n${file.content}\n"""`;
        annotations.push({
          file: {
            filename: file.name,
            content: file.content,
          },
        });
      });
      finalMessage = `${filePreamble}${userMessage}`;
    }

    setInput("");
    setAttachedFiles([]);
    append!({
      role: "user",
      content: "",
      annotations,
      parts: [
        {
          type: "text",
          text: finalMessage,
        },
      ],
    });
  };

  return (
    <div className="max-w-3xl mx-auto fade-in animate-in">
      <div className="z-10 mx-auto w-full max-w-3xl relative">
        <fieldset
          className="flex w-full min-w-0 max-w-full flex-col px-4"
          disabled={isLoadingTools || disabled}
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
            {isInProjectContext ? (
              // Project context layout - send button on same line as text input
              <div className="flex flex-col gap-3.5 px-1">
                {attachedFiles.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {attachedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-2 py-1 text-sm bg-muted rounded-md"
                      >
                        <Paperclip className="size-4" />
                        <span className="flex-1 truncate">{file.name}</span>
                        <button
                          onClick={() => removeFile(index)}
                          className="p-1 hover:bg-muted-foreground/20 rounded-full"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-end gap-2">
                  <div className="flex-1 relative min-h-[2rem]">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        disabled
                          ? t("readOnlyPlaceholder")
                          : (placeholder ?? t("placeholder"))
                      }
                      className="w-full resize-none border-none bg-transparent outline-none text-foreground placeholder:text-muted-foreground min-h-[2rem] max-h-[200px] overflow-y-auto leading-6 px-2 py-1 text-base placeholder:text-base"
                      rows={1}
                      disabled={isLoading || isLoadingTools || disabled}
                    />
                  </div>

                  {!isLoading &&
                  !input.length &&
                  !voiceDisabled &&
                  !disabled ? (
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          onClick={() => {
                            if (isLoading) {
                              onStop();
                            } else {
                              submit();
                            }
                          }}
                          className={cn(
                            "fade-in animate-in cursor-pointer rounded-full p-2 transition-all duration-200 interactive-element",
                            isLoading
                              ? "text-muted-foreground bg-secondary hover:bg-accent-foreground hover:text-accent"
                              : "border text-background bg-primary hover:bg-primary/90",
                            disabled && "opacity-50 cursor-not-allowed",
                          )}
                        >
                          {isLoading ? (
                            <Square
                              size={16}
                              className="fill-muted-foreground text-muted-foreground"
                            />
                          ) : (
                            <CornerRightUp size={16} />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isLoading ? "Stop generation" : "Send a message"}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            ) : (
              // Regular layout for non-project context
              <div className="flex flex-col gap-3.5 px-1">
                {attachedFiles.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {attachedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 px-2 py-1 text-sm bg-muted rounded-md"
                      >
                        <Paperclip className="size-4" />
                        <span className="flex-1 truncate">{file.name}</span>
                        <button
                          onClick={() => removeFile(index)}
                          className="p-1 hover:bg-muted-foreground/20 rounded-full"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="relative min-h-[2rem]">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      disabled
                        ? t("readOnlyPlaceholder")
                        : (placeholder ?? t("placeholder"))
                    }
                    className="w-full resize-none border-none bg-transparent outline-none text-foreground placeholder:text-muted-foreground min-h-[2rem] max-h-[200px] overflow-y-auto leading-6 px-2 py-1 text-base placeholder:text-base"
                    rows={1}
                    disabled={isLoading || isLoadingTools || disabled}
                  />
                </div>

                <div className="flex w-full items-center z-30 gap-1.5">
                  <Button
                    variant={"ghost"}
                    size={"sm"}
                    className="rounded-full hover:bg-input! p-2!"
                    onClick={notImplementedToast}
                  >
                    <Paperclip />
                  </Button>

                  {!toolDisabled && (
                    <>
                      <div className="interactive-element">
                        <ToolModeDropdown disabled={false} />
                      </div>
                      <div className="interactive-element">
                        <ToolSelectDropdown
                          align="start"
                          side="top"
                          disabled={false}
                        />
                      </div>
                    </>
                  )}
                  <div className="flex-1" />

                  {!isLoading &&
                  !input.length &&
                  !voiceDisabled &&
                  !disabled ? (
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
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          onClick={() => {
                            if (isLoading) {
                              onStop();
                            } else {
                              submit();
                            }
                          }}
                          className={cn(
                            "fade-in animate-in cursor-pointer rounded-full p-2 transition-all duration-200 interactive-element",
                            isLoading
                              ? "text-muted-foreground bg-secondary hover:bg-accent-foreground hover:text-accent"
                              : "border text-background bg-primary hover:bg-primary/90",
                            disabled && "opacity-50 cursor-not-allowed",
                          )}
                        >
                          {isLoading ? (
                            <Square
                              size={16}
                              className="fill-muted-foreground text-muted-foreground"
                            />
                          ) : (
                            <CornerRightUp size={16} />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isLoading ? "Stop generation" : "Send a message"}
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            )}
          </div>
        </fieldset>
      </div>
    </div>
  );
}
