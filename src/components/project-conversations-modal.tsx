"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";
import { Button } from "ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "ui/dialog";
import { Project, ChatThread } from "app-types/chat";

interface ProjectConversationsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  project: (Project & { threads: ChatThread[] }) | null;
}

export function ProjectConversationsModal({
  isOpen,
  onOpenChange,
  project,
}: ProjectConversationsModalProps) {
  const t = useTranslations("Chat.Project");
  const [showAllThreads, setShowAllThreads] = useState(false);

  if (!project?.threads || project.threads.length === 0) {
    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Conversations</DialogTitle>
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
      <DialogContent className="max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessagesSquare size={20} />
            Conversations
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto -mr-4 pr-4">
          <div className="flex flex-col gap-2">
            {threadsToShow.map((thread) => (
              <Link
                key={thread.id}
                href={`/chat/${thread.id}`}
                onClick={() => onOpenChange(false)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors group"
              >
                <MessagesSquare
                  size={16}
                  className="text-muted-foreground group-hover:text-primary flex-shrink-0"
                />
                <span className="flex-1 truncate font-medium text-sm group-hover:text-primary">
                  {thread.title}
                </span>
              </Link>
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
