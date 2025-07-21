"use client";

import { useSidebar } from "ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "ui/tooltip";
import { Toggle } from "ui/toggle";
import {
  ChevronDown,
  ChevronRight,
  MessageCircleDashed,
  PanelLeft,
  Share,
} from "lucide-react";
import { Button } from "ui/button";
import { Separator } from "ui/separator";

import { useMemo } from "react";
import { ThreadDropdown } from "../thread-dropdown";
import { appStore } from "@/app/store";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useShallow } from "zustand/shallow";
import { getShortcutKeyList, Shortcuts } from "lib/keyboard-shortcuts";
import { useTranslations } from "next-intl";
import { ThreadVisibilityDropdown } from "../thread-visibility-dropdown";

export function AppHeader() {
  const t = useTranslations();
  const [appStoreMutate, currentThreadId, threadList] = appStore(
    useShallow((state) => [
      state.mutate,
      state.currentThreadId,
      state.threadList,
    ]),
  );
  const { toggleSidebar } = useSidebar();
  const currentPaths = usePathname();

  const currentThread = useMemo(() => {
    if (!currentPaths.startsWith("/chat/")) return null;
    return threadList.find((thread) => thread.id === currentThreadId);
  }, [threadList, currentThreadId, currentPaths]);

  const componentByPage = useMemo(() => {
    if (currentPaths.startsWith("/chat/")) {
      return (
        <ThreadDropdownComponent
          threadList={threadList}
          currentThreadId={currentThreadId}
        />
      );
    }
  }, [currentPaths, threadList, currentThreadId]);

  return (
    <header className="sticky top-0 z-50 flex items-center px-3 py-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Toggle aria-label="Toggle italic" onClick={toggleSidebar}>
              <PanelLeft />
            </Toggle>
          </TooltipTrigger>
          <TooltipContent align="start" side="bottom">
            <div className="flex items-center gap-2">
              {t("KeyboardShortcuts.toggleSidebar")}
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                {getShortcutKeyList(Shortcuts.toggleSidebar).map((key) => (
                  <span
                    key={key}
                    className="w-5 h-5 flex items-center justify-center bg-muted rounded "
                  >
                    {key}
                  </span>
                ))}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {componentByPage}
      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {currentThread && (
          <ThreadVisibilityDropdown thread={currentThread}>
            <Button variant={"outline"}>
              <Share className="size-4" />
              {t("Chat.Thread.shareThreadTitle")}
            </Button>
          </ThreadVisibilityDropdown>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size={"icon"}
              variant={"secondary"}
              className="bg-secondary/40"
              onClick={() => {
                appStoreMutate((state) => ({
                  temporaryChat: {
                    ...state.temporaryChat,
                    isOpen: !state.temporaryChat.isOpen,
                  },
                }));
              }}
            >
              <MessageCircleDashed className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent align="end" side="bottom">
            <div className="text-xs flex items-center gap-2">
              {t("KeyboardShortcuts.toggleTemporaryChat")}
              <div className="text-xs text-muted-foreground flex items-center gap-1">
                {getShortcutKeyList(Shortcuts.toggleTemporaryChat).map(
                  (key) => (
                    <span
                      className="w-5 h-5 flex items-center justify-center bg-muted rounded "
                      key={key}
                    >
                      {key}
                    </span>
                  ),
                )}
              </div>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

function ThreadDropdownComponent({
  threadList,
  currentThreadId,
}: {
  threadList: any[];
  currentThreadId: string | null;
}) {
  const [projectList] = appStore(useShallow((state) => [state.projectList]));
  const currentThread = useMemo(() => {
    return threadList.find((thread) => thread.id === currentThreadId);
  }, [threadList, currentThreadId]);

  const currentProject = useMemo(() => {
    return projectList.find(
      (project) => project.id === currentThread?.projectId,
    );
  }, [currentThread, projectList]);

  if (!currentThread) return null;

  return (
    <div className="items-center gap-1 hidden md:flex">
      <div className="w-1 h-4">
        <Separator orientation="vertical" />
      </div>
      {currentProject && (
        <>
          <Link href={`/project/${currentProject.id}`}>
            <Button variant="ghost" className="flex items-center gap-1">
              <p className="text-muted-foreground max-w-32 truncate">
                {currentProject.name}
              </p>
            </Button>
          </Link>
          <ChevronRight size={14} className="text-muted-foreground" />
        </>
      )}

      <ThreadDropdown
        threadId={currentThread.id}
        beforeTitle={currentThread.title}
      >
        <Button
          variant="ghost"
          className="hover:text-foreground cursor-pointer flex gap-1 items-center px-2 py-1 rounded-md hover:bg-accent"
        >
          <p className="truncate max-w-60 min-w-0">{currentThread.title}</p>

          <ChevronDown size={14} />
        </Button>
      </ThreadDropdown>
    </div>
  );
}
