"use client";

import { useRef, useEffect } from "react";
import { CornerRightUp, PlusIcon, Bot, Wrench } from "lucide-react";
import { cn } from "lib/utils";
import { Button } from "ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";

interface StandaloneLandingInputProps {
  input: string;
  setInput: (value: string) => void;
  onSubmit: () => void;
}

export default function StandaloneLandingInput({
  input,
  setInput,
  onSubmit,
}: StandaloneLandingInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      onSubmit();
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

  return (
    <div className="max-w-4xl mx-auto fade-in animate-in">
      <div className="z-10 mx-auto w-full max-w-4xl relative">
        <fieldset className="flex w-full min-w-0 max-w-full flex-col px-4">
          <div
            onClick={handleContainerClick}
            className={cn(
              "rounded-4xl backdrop-blur-sm transition-all duration-200 bg-muted/80 relative flex w-full flex-col z-10 border border-foreground border-opacity-100 items-stretch p-4",
              "cursor-text focus-within:border-foreground hover:border-foreground ",
            )}
          >
            <div className="flex flex-col gap-4 px-2">
              <div className="relative min-h-[3rem]">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything..."
                  className="w-full resize-none border-none bg-transparent outline-none text-white placeholder:text-gray-400 min-h-[3rem] max-h-[240px] overflow-y-auto leading-7 px-3 py-2 text-lg placeholder:text-lg"
                  rows={1}
                />
              </div>

              <div className="flex w-full items-center z-30">
                {/* Add files button - disabled for landing page */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full hover:bg-input! p-3! mr-2 opacity-50 cursor-not-allowed"
                  disabled
                >
                  <PlusIcon size={18} />
                </Button>

                {/* Tool select dropdown - disabled for landing page */}
                <div className="interactive-element mr-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full hover:bg-input! p-3! opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <Wrench size={18} />
                  </Button>
                </div>

                {/* Project selector dropdown - disabled for landing page */}
                <div className="ml-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full hover:bg-input! p-3! opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <Bot size={18} />
                  </Button>
                </div>

                <div className="flex-1" />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      onClick={() => {
                        if (input.trim()) {
                          onSubmit();
                        }
                      }}
                      className={cn(
                        "fade-in animate-in cursor-pointer rounded-full p-3 transition-all duration-200 interactive-element",
                        input.trim()
                          ? "border text-white bg-primary hover:bg-primary/90"
                          : "text-gray-500/50 cursor-not-allowed",
                      )}
                    >
                      <CornerRightUp size={18} />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>Send a message</TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>
        </fieldset>
      </div>
    </div>
  );
}
