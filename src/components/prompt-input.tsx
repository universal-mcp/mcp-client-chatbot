"use client";

import {
  AudioWaveformIcon,
  CornerRightUp,
  Paperclip,
  PlusIcon,
  Square,
  X,
  Bot,
} from "lucide-react";
import { useRef, useEffect, useState } from "react";
import { UseChatHelpers } from "@ai-sdk/react";
import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { ChatMessageAnnotation } from "app-types/chat";
import { ToolSelectDropdown } from "./tool-select-dropdown";
import { ProjectSelector } from "./project-selector";
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
  disabled?: boolean;
  selectedProjectId?: string | null;
  selectedProject?: { name: string; description?: string | null } | null;
  onProjectClear?: () => void;
  isProjectSelectionDisabled?: boolean;
  projectList?: Array<{ id: string; name: string; description: string | null }>;
  onProjectSelect?: (
    projectId: string | null,
    project?: { name: string; description?: string | null },
  ) => void;
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
  disabled,
  selectedProjectId,
  selectedProject,
  onProjectClear,
  isProjectSelectionDisabled = false,
  projectList = [],
  onProjectSelect,
}: PromptInputProps) {
  const t = useTranslations("Chat");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<
    { name: string; content: string }[]
  >([]);

  const [currentThreadId, appStoreMutate, isMcpClientListLoading] = appStore(
    useShallow((state) => [
      state.currentThreadId,
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
              "shadow-lg overflow-hidden rounded-4xl backdrop-blur-sm transition-all duration-200 bg-muted/60 relative flex w-full flex-col cursor-text z-10 items-stretch focus-within:bg-muted hover:bg-muted focus-within:ring-muted hover:ring-muted",
              isLoadingTools && "cursor-wait animate-pulse",
            )}
          >
            {selectedProject && (
              <div className="bg-input rounded-b-sm rounded-t-3xl p-3 flex flex-col gap-4 mx-2 mt-2">
                <div className="flex items-center gap-2">
                  <Button className="size-6 flex items-center justify-center ring ring-border rounded-full flex-shrink-0 p-0.5">
                    <Bot className="size-3.5" />
                  </Button>
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm font-semibold truncate">
                      {selectedProject.name}
                    </span>
                    {selectedProject.description ? (
                      <span className="text-muted-foreground text-xs truncate">
                        {selectedProject.description}
                      </span>
                    ) : null}
                  </div>
                  {!isProjectSelectionDisabled && (
                    <Button
                      variant={"ghost"}
                      size={"icon"}
                      onClick={onProjectClear}
                      className="rounded-full hover:bg-input! flex-shrink-0"
                    >
                      <X />
                    </Button>
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-col gap-3.5 px-5 pt-3 pb-4">
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

              <div className="flex w-full items-center z-30">
                <Button
                  variant={"ghost"}
                  size={"sm"}
                  className="rounded-full hover:bg-input! p-2! mr-1"
                  onClick={notImplementedToast}
                >
                  <PlusIcon />
                </Button>

                {!toolDisabled && (
                  <div className="interactive-element mx-1">
                    <ToolSelectDropdown
                      align="start"
                      side="top"
                      disabled={false}
                      projectId={selectedProjectId || undefined}
                    />
                  </div>
                )}

                <div className="ml-1">
                  <ProjectSelector
                    selectedProjectId={selectedProjectId}
                    selectedProject={selectedProject}
                    projectList={projectList}
                    onProjectSelect={onProjectSelect}
                    disabled={isProjectSelectionDisabled}
                  />
                </div>
                <div className="flex-1" />

                {!isLoading && !input.length && !voiceDisabled && !disabled ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size={"sm"}
                        onClick={() => {
                          appStoreMutate((state) => ({
                            voiceChat: {
                              ...state.voiceChat,
                              isOpen: true,
                              threadId: currentThreadId ?? undefined,
                              projectId: selectedProjectId ?? undefined,
                            },
                          }));
                        }}
                        className="rounded-full p-2!"
                      >
                        <AudioWaveformIcon size={16} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t("VoiceChat.title")}</TooltipContent>
                  </Tooltip>
                ) : isLoading ? (
                  <div
                    onClick={() => {
                      onStop();
                    }}
                    className={cn(
                      "fade-in animate-in cursor-pointer text-muted-foreground rounded-full p-2 bg-secondary hover:bg-accent-foreground hover:text-accent transition-all duration-200",
                      disabled && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <Square
                      size={16}
                      className="fill-muted-foreground text-muted-foreground"
                    />
                  </div>
                ) : (
                  <Button
                    size={"sm"}
                    onClick={() => submit()}
                    className={cn(
                      "rounded-full p-2! text-background bg-primary hover:bg-primary/90",
                      disabled && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <CornerRightUp size={16} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
