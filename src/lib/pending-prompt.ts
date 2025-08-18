"use client";

import { getStorageManager } from "lib/browser-stroage";

const storage = getStorageManager<string>("pending-prompt", "session");

export const setPendingPrompt = (prompt: string) => {
  if (!prompt) return;
  storage.set(prompt);
};

export const getPendingPrompt = (): string | undefined => {
  return storage.get();
};

export const clearPendingPrompt = () => {
  storage.remove();
};
