"use client";

import { appStore } from "@/app/store";
import { useCompletion } from "@ai-sdk/react";
import { useCallback, useEffect } from "react";
import { mutate } from "swr";
import { safe } from "ts-safe";

export function useGenerateThreadTitle(option: {
  threadId: string;
  projectId?: string;
}) {
  const { complete, completion } = useCompletion({
    api: "/api/chat/title",
  });

  const generateTitle = useCallback(
    (message: string) => {
      const { threadId, projectId } = option;
      if (appStore.getState().generatingTitleThreadIds.includes(threadId))
        return;
      appStore.setState((prev) => ({
        generatingTitleThreadIds: [...prev.generatingTitleThreadIds, threadId],
      }));
      safe(() =>
        complete("", {
          body: {
            message,
            threadId,
            projectId,
          },
        }),
      )
        .ifOk(() => mutate("threads"))
        .watch(() => {
          appStore.setState((prev) => ({
            generatingTitleThreadIds: prev.generatingTitleThreadIds.filter(
              (v) => v !== threadId,
            ),
          }));
        });
    },
    [option],
  );

  useEffect(() => {
    const title = completion.trim();
    if (title) {
      appStore.setState((prev) => {
        if (prev.threadList.some((v) => v.id !== option.threadId)) {
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
    }
  }, [completion, option.threadId]);

  return generateTitle;
}
