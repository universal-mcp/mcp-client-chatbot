"use client";

import { UIMessage } from "ai";
import {
  Check,
  Copy,
  Loader,
  Pencil,
  ChevronDownIcon,
  RefreshCw,
  X,
  Trash2,
  ChevronRight,
  TriangleAlert,
  HammerIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "ui/tooltip";
import { Button } from "ui/button";
import { Markdown } from "./markdown";
import { cn, safeJSONParse } from "lib/utils";
import JsonView from "ui/json-view";
import { useMemo, useState, memo, useEffect, useRef, useCallback } from "react";
import { MessageEditor } from "./message-editor";
import type { UseChatHelpers } from "@ai-sdk/react";
import { useCopy } from "@/hooks/use-copy";
import { AnimatePresence, motion } from "framer-motion";
import {
  deleteMessageAction,
  deleteMessagesByChatIdAfterTimestampAction,
} from "@/app/api/chat/actions";
import { toast } from "sonner";
import { safe } from "ts-safe";
import { ClientToolInvocation, ToolInvocationUIPart } from "app-types/chat";
import { Skeleton } from "ui/skeleton";
import { useTranslations } from "next-intl";
import { extractMCPToolId } from "lib/ai/mcp/mcp-tool-id";
import { Separator } from "ui/separator";
import { Paperclip, ArrowUpRight } from "lucide-react";
import { FileContentPopup } from "./file-content-popup";
import { TextShimmer } from "ui/text-shimmer";
import { DefaultToolName } from "lib/ai/tools";
import equal from "fast-deep-equal";
import dynamic from "next/dynamic";

type MessagePart = UIMessage["parts"][number];

type TextMessagePart = Extract<MessagePart, { type: "text" }>;
type AssistMessagePart = Extract<MessagePart, { type: "text" }>;

interface UserMessagePartProps {
  part: TextMessagePart;
  isLast: boolean;
  message: UIMessage;
  setMessages: UseChatHelpers["setMessages"];
  reload: UseChatHelpers["reload"];
  status: UseChatHelpers["status"];
  isError?: boolean;
  isReadOnly?: boolean;
}

interface AssistMessagePartProps {
  part: AssistMessagePart;
  message: UIMessage;
  showActions: boolean;
  threadId?: string;
  setMessages: UseChatHelpers["setMessages"];
  reload: UseChatHelpers["reload"];
  isError?: boolean;
  isReadOnly?: boolean;
}

interface ToolMessagePartProps {
  part: ToolInvocationUIPart;
  messageId: string;
  showActions: boolean;
  isLast?: boolean;
  isManualToolInvocation?: boolean;
  onPoxyToolCall?: (result: ClientToolInvocation) => void;
  isError?: boolean;
  setMessages?: UseChatHelpers["setMessages"];
  isReadOnly?: boolean;
}

interface HighlightedTextProps {
  text: string;
}

const HighlightedText = memo(({ text }: HighlightedTextProps) => {
  const parts = text.split(/(\s+)/);
  return parts.map((part, index) => {
    if (part.trim() === "```") {
      return (
        <span key={index} className="mention">
          {part}
        </span>
      );
    }
    return part;
  });
});

HighlightedText.displayName = "HighlightedText";

export const UserMessagePart = memo(
  function UserMessagePart({
    part,
    isLast,
    status,
    message,
    setMessages,
    reload,
    isError,
    isReadOnly,
  }: UserMessagePartProps) {
    const { copied, copy } = useCopy();
    const [mode, setMode] = useState<"view" | "edit">("view");
    const [isDeleting, setIsDeleting] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    const scrolledRef = useRef(false);
    const fileAnnotations = useMemo(() => {
      if (!message.annotations?.length) return [];
      return message.annotations
        .filter(
          (ann): ann is { file: { filename: string; content: string } } =>
            typeof ann === "object" &&
            ann !== null &&
            "file" in ann &&
            !!ann.file,
        )
        .map((ann) => ann.file);
    }, [message.annotations]);

    const deleteMessage = useCallback(() => {
      safe(() => setIsDeleting(true))
        .ifOk(() => deleteMessageAction(message.id))
        .ifOk(() =>
          setMessages((messages) => {
            const index = messages.findIndex((m) => m.id === message.id);
            if (index !== -1) {
              return messages.filter((_, i) => i !== index);
            }
            return messages;
          }),
        )
        .ifFail((error) => toast.error(error.message))
        .watch(() => setIsDeleting(false))
        .unwrap();
    }, [message.id]);

    useEffect(() => {
      if (status === "submitted" && isLast && !scrolledRef.current) {
        scrolledRef.current = true;
        ref.current?.scrollIntoView({ behavior: "smooth" });
      }
    }, [status]);

    if (mode === "edit") {
      return (
        <div className="flex flex-row gap-2 items-start w-full">
          <MessageEditor
            message={message}
            setMode={setMode}
            setMessages={setMessages}
            reload={reload}
          />
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-2 items-end my-2">
        <div
          data-testid="message-content"
          className={cn(
            "flex flex-col gap-4 max-w-full",
            "flex flex-col gap-4 max-w-full ring ring-input",
            {
              "bg-secondary text-secondary-foreground px-4 py-3 rounded-2xl": true, // Always apply user message styling
              "opacity-50": isError,
            },
            isError && "border-destructive border",
          )}
        >
          {fileAnnotations.length > 0 && (
            <div className="flex flex-col gap-2 text-sm border-b pb-2">
              {fileAnnotations.map((file, index) => (
                <FileContentPopup
                  key={index}
                  content={file.content}
                  title={file.filename}
                >
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs w-full justify-start"
                  >
                    <Paperclip className="size-4 mr-2" />
                    <span className="flex-1 truncate">{file.filename}</span>
                    <ArrowUpRight className="size-4 ml-2" />
                  </Button>
                </FileContentPopup>
              ))}
            </div>
          )}
          <p className={cn("whitespace-pre-wrap text-sm break-words")}>
            <HighlightedText text={part.text.replace(/"""[\s\S]*?"""/g, "")} />
          </p>
        </div>

        <div className="flex w-full justify-end">
          {isLast && !isReadOnly && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-testid="message-edit-button"
                    variant="ghost"
                    size="icon"
                    className={cn(
                      "size-3! p-4! opacity-0 group-hover/message:opacity-100",
                    )}
                    onClick={() => copy(part.text)}
                    disabled={isReadOnly}
                  >
                    {copied ? <Check /> : <Copy />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Copy</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-testid="message-edit-button"
                    variant="ghost"
                    size="icon"
                    className="size-3! p-4! opacity-0 group-hover/message:opacity-100"
                    onClick={() => setMode("edit")}
                    disabled={isReadOnly}
                  >
                    <Pencil />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Edit</TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    disabled={isDeleting || isReadOnly}
                    onClick={deleteMessage}
                    variant="ghost"
                    size="icon"
                    className="size-3! p-4! opacity-0 group-hover/message:opacity-100 hover:text-destructive"
                  >
                    {isDeleting ? (
                      <Loader className="animate-spin" />
                    ) : (
                      <Trash2 />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-destructive" side="bottom">
                  Delete Message
                </TooltipContent>
              </Tooltip>
            </>
          )}
        </div>
        <div ref={ref} className="min-w-0" />
      </div>
    );
  },
  (prev, next) => {
    if (prev.part.text != next.part.text) return false;
    if (prev.isError != next.isError) return false;
    if (prev.isLast != next.isLast) return false;
    if (prev.status != next.status) return false;
    if (prev.message.id != next.message.id) return false;
    if (!equal(prev.part, next.part)) return false;
    return true;
  },
);
UserMessagePart.displayName = "UserMessagePart";

export const AssistMessagePart = ({
  part,
  showActions,
  reload,
  message,
  setMessages,
  isError,
  threadId,
  isReadOnly,
}: AssistMessagePartProps) => {
  const { copied, copy } = useCopy();
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteMessage = useCallback(() => {
    safe(() => setIsDeleting(true))
      .ifOk(() => deleteMessageAction(message.id))
      .ifOk(() =>
        setMessages((messages) => {
          const index = messages.findIndex((m) => m.id === message.id);
          if (index !== -1) {
            return messages.filter((_, i) => i !== index);
          }
          return messages;
        }),
      )
      .ifFail((error) => toast.error(error.message))
      .watch(() => setIsDeleting(false))
      .unwrap();
  }, [message.id]);

  const refreshAnswer = () => {
    safe(() => setIsLoading(true))
      .ifOk(() =>
        threadId
          ? deleteMessagesByChatIdAfterTimestampAction(message.id)
          : Promise.resolve(),
      )
      .ifOk(() =>
        setMessages((messages) => {
          const index = messages.findIndex((m) => m.id === message.id);
          if (index !== -1) {
            return [...messages.slice(0, index)];
          }
          return messages;
        }),
      )
      .ifOk(() =>
        reload({
          body: {
            id: threadId,
          },
        }),
      )
      .ifFail((error) => toast.error(error.message))
      .watch(() => setIsLoading(false))
      .unwrap();
  };

  return (
    <div className={cn(isLoading && "animate-pulse", "flex flex-col gap-2")}>
      <div
        data-testid="message-content"
        className={cn("flex flex-col gap-4 px-2", {
          "opacity-50 border border-destructive bg-card rounded-lg": isError,
        })}
      >
        <Markdown>{part.text}</Markdown>
      </div>
      {showActions && !isReadOnly && (
        <div className="flex w-full">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-testid="message-edit-button"
                variant="ghost"
                size="icon"
                className="size-3! p-4!"
                onClick={() => copy(part.text)}
                disabled={isReadOnly}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-testid="message-refresh-button"
                variant="ghost"
                size="icon"
                onClick={refreshAnswer}
                className="size-3! p-4!"
                disabled={isReadOnly}
              >
                {<RefreshCw />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Refresh answer</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                disabled={isDeleting || isReadOnly}
                onClick={deleteMessage}
                className="size-3! p-4! hover:text-destructive"
              >
                {isDeleting ? <Loader className="animate-spin" /> : <Trash2 />}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-destructive" side="bottom">
              Delete Message
            </TooltipContent>
          </Tooltip>
        </div>
      )}
    </div>
  );
};

export const ToolMessagePart = memo(
  ({
    part,
    isLast,
    showActions,
    onPoxyToolCall,
    isError,
    messageId,
    setMessages,
    isManualToolInvocation,
    isReadOnly,
  }: ToolMessagePartProps) => {
    const t = useTranslations("");
    const { toolInvocation } = part;
    const { toolName, toolCallId, state, args } = toolInvocation;
    const [expanded, setExpanded] = useState(false);
    const { copied: copiedInput, copy: copyInput } = useCopy();
    const { copied: copiedOutput, copy: copyOutput } = useCopy();
    const [isDeleting, setIsDeleting] = useState(false);
    const isExecuting = state !== "result" && (isLast || onPoxyToolCall);
    const deleteMessage = useCallback(() => {
      safe(() => setIsDeleting(true))
        .ifOk(() => deleteMessageAction(messageId))
        .ifOk(() =>
          setMessages?.((messages) => {
            const index = messages.findIndex((m) => m.id === messageId);
            if (index !== -1) {
              return messages.filter((_, i) => i !== index);
            }
            return messages;
          }),
        )
        .ifFail((error) => toast.error(error.message))
        .watch(() => setIsDeleting(false))
        .unwrap();
    }, [messageId]);

    const onToolCallDirect = useMemo(
      () =>
        onPoxyToolCall
          ? (result: any) => {
              return onPoxyToolCall({
                action: "direct",
                result,
              });
            }
          : undefined,
      [onPoxyToolCall],
    );

    const result = useMemo(() => {
      if (state === "result") {
        return Array.isArray(toolInvocation.result?.content)
          ? {
              ...toolInvocation.result,
              content: toolInvocation.result.content.map((node) => {
                // mcp tools
                if (node?.type === "text" && typeof node?.text === "string") {
                  const parsed = safeJSONParse(node.text);
                  return {
                    ...node,
                    text: parsed.success ? parsed.value : node.text,
                  };
                }
                return node;
              }),
            }
          : toolInvocation.result;
      }
      return null;
    }, [state, (toolInvocation as any).result]);

    const ToolResultComponent = useMemo(() => {
      if (
        toolName === DefaultToolName.WebSearch ||
        toolName === DefaultToolName.WebContent
      ) {
        return <WebSearchToolInvocation part={toolInvocation} />;
      }

      if (toolName === DefaultToolName.PythonExecution) {
        return (
          <CodeExecutor
            part={toolInvocation}
            onResult={onToolCallDirect}
            type="python"
          />
        );
      }

      if (state === "result") {
        switch (toolName) {
          case DefaultToolName.CreatePieChart:
            return (
              <PieChart key={`${toolCallId}-${toolName}`} {...(args as any)} />
            );
          case DefaultToolName.CreateBarChart:
            return (
              <BarChart key={`${toolCallId}-${toolName}`} {...(args as any)} />
            );
          case DefaultToolName.CreateLineChart:
            return (
              <LineChart key={`${toolCallId}-${toolName}`} {...(args as any)} />
            );
          case DefaultToolName.CreateTable:
            return (
              <InteractiveTable
                key={`${toolCallId}-${toolName}`}
                {...(args as any)}
              />
            );
        }
      }
      return null;
    }, [toolName, state, onToolCallDirect, result, args]);

    const { serverName: mcpServerName, toolName: mcpToolName } = useMemo(() => {
      return extractMCPToolId(toolName);
    }, [toolName]);

    const isExpanded = useMemo(() => {
      return expanded || result === null;
    }, [expanded, result]);

    return (
      <div className="group w-full">
        {ToolResultComponent ? (
          ToolResultComponent
        ) : (
          <div className="flex flex-col fade-in duration-300 animate-in">
            <div
              className="flex gap-2 items-center cursor-pointer group/title"
              onClick={() => setExpanded(!expanded)}
            >
              <div className="p-1.5 text-primary bg-input/40 rounded">
                {isExecuting ? (
                  <Loader className="size-3.5 animate-spin" />
                ) : isError ? (
                  <TriangleAlert className="size-3.5 text-destructive" />
                ) : (
                  <HammerIcon className="size-3.5" />
                )}
              </div>
              <span className="font-bold flex items-center gap-2">
                {isExecuting ? (
                  <TextShimmer>{mcpServerName}</TextShimmer>
                ) : (
                  mcpServerName
                )}
              </span>
              {mcpToolName && (
                <>
                  <ChevronRight className="size-3.5" />
                  <span className="text-muted-foreground group-hover/title:text-primary transition-colors duration-300">
                    {mcpToolName}
                  </span>
                </>
              )}
              <div className="ml-auto group-hover/title:bg-input p-1.5 rounded transition-colors duration-300">
                <ChevronDownIcon
                  className={cn(isExpanded && "rotate-180", "size-3.5")}
                />
              </div>
            </div>
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  key="content"
                  initial="collapsed"
                  animate="expanded"
                  exit="collapsed"
                  variants={{
                    expanded: {
                      height: "auto",
                      opacity: 1,
                      paddingTop: "0.5rem",
                      paddingBottom: "0.5rem",
                    },
                    collapsed: {
                      height: 0,
                      opacity: 0,
                      paddingTop: 0,
                      paddingBottom: 0,
                    },
                  }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  style={{ overflow: "hidden" }}
                  className="flex gap-2"
                >
                  <div className="w-7 flex justify-center">
                    <Separator
                      orientation="vertical"
                      className="h-full bg-gradient-to-t from-transparent to-border to-5%"
                    />
                  </div>
                  <div className="w-full flex flex-col gap-2">
                    <div className="min-w-0 w-full p-4 rounded-lg bg-card px-4 border text-xs">
                      <div className="flex items-center">
                        <h5 className="text-muted-foreground font-medium select-none">
                          Request
                        </h5>
                        <div className="flex-1" />
                        {!isReadOnly &&
                          (copiedInput ? (
                            <Check className="size-3" />
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-3 text-muted-foreground"
                              onClick={() =>
                                copyInput(JSON.stringify(toolInvocation.args))
                              }
                              disabled={isReadOnly}
                            >
                              <Copy />
                            </Button>
                          ))}
                      </div>
                      <div className="p-2 max-h-[300px] overflow-y-auto ">
                        <JsonView data={toolInvocation.args} />
                      </div>
                    </div>
                    {result && (
                      <div className="min-w-0 w-full p-4 rounded-lg bg-card px-4 border text-xs mt-2">
                        <div className="flex items-center">
                          <h5 className="text-muted-foreground font-medium select-none">
                            Response
                          </h5>
                          <div className="flex-1" />
                          {!isReadOnly &&
                            (copiedOutput ? (
                              <Check className="size-3" />
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-3 text-muted-foreground"
                                onClick={() =>
                                  copyOutput(JSON.stringify(result))
                                }
                                disabled={isReadOnly}
                              >
                                <Copy />
                              </Button>
                            ))}
                        </div>
                        <div className="p-2 max-h-[300px] overflow-y-auto">
                          {Array.isArray(result) ? (
                            <div className="flex flex-col gap-2">
                              {result.map((item: any, index) => {
                                if (item.type === "text") {
                                  if (typeof item.text === "string") {
                                    return (
                                      <Markdown key={index}>
                                        {item.text}
                                      </Markdown>
                                    );
                                  }
                                  return (
                                    <JsonView key={index} data={item.text} />
                                  );
                                }
                                return <JsonView key={index} data={item} />;
                              })}
                            </div>
                          ) : (
                            <JsonView data={result} />
                          )}
                        </div>
                      </div>
                    )}

                    {onPoxyToolCall && isManualToolInvocation && (
                      <div className="flex flex-row gap-2 items-center mt-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          className="rounded-full text-xs hover:ring"
                          onClick={() =>
                            onPoxyToolCall({ action: "manual", result: true })
                          }
                          disabled={isReadOnly}
                        >
                          <Check />
                          {t("Common.approve")}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full text-xs"
                          onClick={() =>
                            onPoxyToolCall({ action: "manual", result: false })
                          }
                          disabled={isReadOnly}
                        >
                          <X />
                          {t("Common.reject")}
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {showActions && !isReadOnly && (
              <div className="flex flex-row gap-2 items-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      disabled={isDeleting || isReadOnly}
                      onClick={deleteMessage}
                      variant="ghost"
                      size="icon"
                      className="size-3! p-4! opacity-0 group-hover/message:opacity-100 hover:text-destructive"
                    >
                      {isDeleting ? (
                        <Loader className="animate-spin" />
                      ) : (
                        <Trash2 />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="text-destructive" side="bottom">
                    Delete Message
                  </TooltipContent>
                </Tooltip>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
  (prev, next) => {
    if (prev.isError !== next.isError) return false;
    if (prev.isLast !== next.isLast) return false;
    if (prev.onPoxyToolCall !== next.onPoxyToolCall) return false;
    if (prev.showActions !== next.showActions) return false;
    if (prev.isManualToolInvocation !== next.isManualToolInvocation)
      return false;
    if (prev.messageId !== next.messageId) return false;
    return true;
  },
);

ToolMessagePart.displayName = "ToolMessagePart";

export const ReasoningPart = memo(function ReasoningPart({
  reasoning,
  isThinking,
}: {
  reasoning: string;
  isThinking?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(isThinking);

  const variants = {
    collapsed: {
      height: 0,
      opacity: 0,
      marginTop: 0,
      marginBottom: 0,
    },
    expanded: {
      height: "auto",
      opacity: 1,
      marginTop: "1rem",
      marginBottom: "0.5rem",
    },
  };

  useEffect(() => {
    if (!isThinking && isExpanded) {
      setIsExpanded(false);
    }
  }, [isThinking]);

  return (
    <div
      className="flex flex-col cursor-pointer"
      onClick={() => {
        setIsExpanded(!isExpanded);
      }}
    >
      <div className="flex flex-row gap-2 items-center text-ring hover:text-primary transition-colors">
        {isThinking ? (
          <TextShimmer>Reasoned for a few seconds</TextShimmer>
        ) : (
          <div className="font-medium">Reasoned for a few seconds</div>
        )}

        <button
          data-testid="message-reasoning-toggle"
          type="button"
          className="cursor-pointer"
        >
          <ChevronDownIcon size={16} />
        </button>
      </div>

      <div className="pl-4">
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              data-testid="message-reasoning"
              key="content"
              initial="collapsed"
              animate="expanded"
              exit="collapsed"
              variants={variants}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
              className="pl-6 text-muted-foreground border-l flex flex-col gap-4"
            >
              <Markdown>{reasoning}</Markdown>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});
ReasoningPart.displayName = "ReasoningPart";
const loading = memo(function Loading() {
  return (
    <div className="px-6 py-4">
      <Skeleton className="h-44 w-full rounded-md" />
    </div>
  );
});

const PieChart = dynamic(
  () => import("./tool-invocation/pie-chart").then((mod) => mod.PieChart),
  {
    ssr: false,
    loading,
  },
);

const BarChart = dynamic(
  () => import("./tool-invocation/bar-chart").then((mod) => mod.BarChart),
  {
    ssr: false,
    loading,
  },
);

const LineChart = dynamic(
  () => import("./tool-invocation/line-chart").then((mod) => mod.LineChart),
  {
    ssr: false,
    loading,
  },
);

const InteractiveTable = dynamic(
  () =>
    import("./tool-invocation/interactive-table").then(
      (mod) => mod.InteractiveTable,
    ),
  {
    ssr: false,
    loading,
  },
);

const WebSearchToolInvocation = dynamic(
  () =>
    import("./tool-invocation/web-search").then(
      (mod) => mod.WebSearchToolInvocation,
    ),
  {
    ssr: false,
    loading,
  },
);

const CodeExecutor = dynamic(
  () =>
    import("./tool-invocation/code-executor").then((mod) => mod.CodeExecutor),
  {
    ssr: false,
    loading,
  },
);
