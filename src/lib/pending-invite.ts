"use client";

import { getStorageManager } from "lib/browser-stroage";

const storage = getStorageManager<string>("pending-invite", "session");

export const setPendingInvite = (inviteId: string) => {
  if (!inviteId) return;
  storage.set(inviteId);
};

export const getPendingInvite = (): string | undefined => {
  return storage.get();
};

export const clearPendingInvite = () => {
  storage.remove();
};
