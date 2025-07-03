"use client";

import { useEffect, useMemo, useState } from "react";
import { AutoHeight } from "ui/auto-height";

import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { isShortcutEvent, Shortcuts } from "lib/keyboard-shortcuts";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerPortal,
  DrawerTitle,
} from "ui/drawer";
import {
  MCPInstructionsContent,
  UserInstructionsContent,
} from "./chat-preferences-content";
import { UserIcon, ArrowLeft } from "lucide-react";
import { Button } from "ui/button";
import { useTranslations } from "next-intl";
import { MCPIcon } from "ui/mcp-icon";

export function ChatPreferencesPopup() {
  const [openChatPreferences, appStoreMutate] = appStore(
    useShallow((state) => [state.openChatPreferences, state.mutate]),
  );

  const t = useTranslations();

  const tabs = useMemo(() => {
    return [
      {
        label: t("Chat.ChatPreferences.userInstructions"),
        icon: <UserIcon className="w-4 h-4" />,
      },
      {
        label: t("Chat.ChatPreferences.mcpInstructions"),
        icon: <MCPIcon className="w-4 h-4 fill-muted-foreground" />,
      },
    ];
  }, []);

  const [tab, setTab] = useState(0);

  const handleClose = () => {
    appStoreMutate({ openChatPreferences: false });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isChatPreferencesEvent = isShortcutEvent(
        e,
        Shortcuts.openChatPreferences,
      );
      if (isChatPreferencesEvent) {
        e.preventDefault();
        e.stopPropagation();
        appStoreMutate((prev) => ({
          openChatPreferences: !prev.openChatPreferences,
        }));
      }

      // ESC key to close
      if (e.key === "Escape" && openChatPreferences) {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openChatPreferences]);

  useEffect(() => {
    if (!openChatPreferences) setTab(0);
  }, [openChatPreferences]);

  return (
    <Drawer
      handleOnly
      open={openChatPreferences}
      direction="top"
      onOpenChange={(open) => appStoreMutate({ openChatPreferences: open })}
    >
      <DrawerPortal>
        <DrawerContent
          style={{
            userSelect: "text",
          }}
          className="max-h-[100vh]! w-full h-full border-none rounded-none flex flex-col bg-card overflow-hidden p-4 md:p-6"
        >
          <DrawerTitle className="sr-only">Chat Preferences</DrawerTitle>
          <DrawerDescription className="sr-only" />

          <div className="flex flex-1 items-center justify-center pt-8 pb-16">
            <div className="w-full max-w-5xl">
              {/* Header with Back Button and Tabs */}
              <div className="flex flex-col gap-4 mb-6">
                {/* Back Button */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClose}
                    className="flex items-center gap-2 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm font-medium">Back</span>
                  </Button>
                </div>

                {/* Horizontal Tabs */}
                <div className="flex gap-2 border-b border-border">
                  {tabs.map((tabItem, index) => (
                    <button
                      key={index}
                      onClick={() => setTab(index)}
                      className={`flex items-center gap-2 px-4 py-3 rounded-t-lg text-sm font-medium transition-all duration-200 border-b-2 -mb-px ${
                        tab === index
                          ? "bg-primary/5 text-primary border-primary"
                          : "text-muted-foreground hover:text-foreground border-transparent hover:bg-muted/30"
                      }`}
                    >
                      {tabItem.icon}
                      <span>{tabItem.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Content */}
              <AutoHeight className="w-full rounded-lg border max-h-[70vh] overflow-y-auto">
                <div className="p-6 md:p-8">
                  {openChatPreferences && (
                    <>
                      {tab == 0 ? (
                        <UserInstructionsContent />
                      ) : tab == 1 ? (
                        <MCPInstructionsContent />
                      ) : null}
                    </>
                  )}
                </div>
              </AutoHeight>
            </div>
          </div>
        </DrawerContent>
      </DrawerPortal>
    </Drawer>
  );
}
