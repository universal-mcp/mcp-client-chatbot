"use client";

import { appStore } from "@/app/store";
import { useCompletion } from "@ai-sdk/react";
import { ChatModel } from "app-types/chat";
import { useCallback } from "react";
import { mutate } from "swr";

export function useGenerateThreadTitle(option: {
  threadId: string;
  projectId?: string;
  chatModel?: ChatModel;
}) {
  const { complete } = useCompletion({
    api: "/api/chat/title",
  });

  const updateTitle = useCallback(
    (title: string) => {
      appStore.setState((prev) => {
        if (!prev.threadList.some((v) => v.id === option.threadId)) {
          return {
            threadList: [
              {
                id: option.threadId,
                title,
                userId: "",
                createdAt: new Date(),
                projectId: option.projectId ?? null,
                isPublic: false,
              },
              ...prev.threadList,
            ],
          };
        }

        return {
          threadList: prev.threadList.map((v) =>
            v.id === option.threadId ? { ...v, title } : v,
          ),
        };
      });
    },
    [
      option.projectId,
      option.threadId,
      option.chatModel?.model,
      option.chatModel?.provider,
    ],
  );

  const generateTitle = useCallback(
    async (message: string) => {
      const { threadId, projectId } = option;
      if (appStore.getState().generatingTitleThreadIds.includes(threadId))
        return;
      appStore.setState((prev) => ({
        generatingTitleThreadIds: [...prev.generatingTitleThreadIds, threadId],
      }));
      updateTitle("");
      try {
        const title = await complete("", {
          body: {
            message,
            threadId,
            projectId,
          },
        });
        if (title) {
          updateTitle(title.trim());
        }
        mutate("/api/thread/list");
      } finally {
        appStore.setState((prev) => ({
          generatingTitleThreadIds: prev.generatingTitleThreadIds.filter(
            (v) => v !== threadId,
          ),
        }));
      }
    },
    [updateTitle, complete, option],
  );

  return generateTitle;
}
