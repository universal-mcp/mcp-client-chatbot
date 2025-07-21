"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { MessagesSquare, MoreHorizontal } from "lucide-react";
import { Button } from "ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "ui/dialog";
import { ThreadDropdown } from "./thread-dropdown";
import { Project, ChatThread } from "app-types/chat";

interface ProjectConversationsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: (Project & { threads: ChatThread[] }) | null;
  onThreadDeleted: () => void;
}

export function ProjectConversationsModal({
  isOpen,
  onOpenChange,
  project,
  onThreadDeleted,
}: ProjectConversationsModalProps) {
  const t = useTranslations("Chat.Project");
  const [showAllThreads, setShowAllThreads] = useState(false);

  if (!project?.threads || project.threads.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Conversations in {project?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground py-12">
            <MessagesSquare
              size={48}
              className="mb-4 text-muted-foreground/50"
            />
            <h3 className="text-lg font-medium mb-2">
              {t("noConversationsYet")}
            </h3>
            <p className="text-sm max-w-md">
              {t("enterNewPromptToStartYourFirstConversation")}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const threadsToShow = showAllThreads
    ? project.threads
    : project.threads.slice(0, 12);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessagesSquare size={20} />
            Conversations in {project.name}
            <span className="text-sm font-normal text-muted-foreground ml-2">
              ({project.threads.length} total)
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-2">
            {threadsToShow.map((thread) => (
              <div
                key={thread.id}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors group"
              >
                <MessagesSquare
                  size={16}
                  className="text-primary flex-shrink-0"
                />
                <Link
                  href={`/chat/${thread.id}`}
                  className="flex-1 min-w-0"
                  onClick={() => onOpenChange(false)}
                >
                  <div className="font-medium truncate hover:text-primary transition-colors">
                    {thread.title}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {/* You can add created date here if available */}
                    Click to open conversation
                  </div>
                </Link>
                <ThreadDropdown
                  threadId={thread.id}
                  beforeTitle={thread.title}
                  onDeleted={onThreadDeleted}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </ThreadDropdown>
              </div>
            ))}
          </div>

          {project.threads.length > 12 && !showAllThreads && (
            <div className="mt-6 text-center">
              <Button
                variant="outline"
                onClick={() => setShowAllThreads(true)}
                className="w-full"
              >
                Show {project.threads.length - 12} more conversations
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
