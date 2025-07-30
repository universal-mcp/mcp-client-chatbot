"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
  DialogFooter,
} from "ui/dialog";

import { Button } from "ui/button";
import { Loader } from "lucide-react";
import { useEffect, useState } from "react";
import { safe } from "ts-safe";
import { updateProjectAction } from "@/app/api/chat/actions";
import { toast } from "sonner";
import { handleErrorWithToast } from "ui/shared-toast";
import { useTranslations } from "next-intl";
import Tiptap from "./tiptap";

interface ProjectSystemMessagePopupProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (systemPrompt: string) => void;
  projectId: string;
  beforeSystemMessage?: string;
}

export function ProjectSystemMessagePopup({
  isOpen,
  onOpenChange,
  onSave,
  projectId,
  beforeSystemMessage,
}: ProjectSystemMessagePopupProps) {
  const t = useTranslations();
  const [systemPrompt, setSystemPrompt] = useState(beforeSystemMessage || "");
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    safe(() => setIsLoading(true))
      .map(() =>
        updateProjectAction(projectId, { instructions: { systemPrompt } }),
      )
      .watch(() => setIsLoading(false))
      .ifOk(() => onSave(systemPrompt))
      .ifOk(() => toast.success(t("Chat.Project.projectInstructionsUpdated")))
      .ifOk(() => onOpenChange(false))
      .ifFail(handleErrorWithToast);
  };
  useEffect(() => {
    if (isOpen) {
      setSystemPrompt(beforeSystemMessage || "");
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card w-full sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("Chat.Project.projectInstructions")}</DialogTitle>
          <DialogDescription asChild>
            <div className="py-4">
              <p className="font-semibold mb-2">
                {t("Chat.Project.howCanTheChatBotBestHelpYouWithThisProject")}
              </p>
              {t(
                "Chat.Project.youCanAskTheChatBotToFocusOnASpecificTopicOrToRespondInAParticularToneOrFormat",
              )}
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="w-full">
          <Tiptap
            value={systemPrompt}
            onChange={setSystemPrompt}
            placeholder="e.g. You are a Korean travel guide assistant. Respond only in Korean, include precise times for every itinerary item, and present transportation, budget, and dining recommendations succinctly in a table format."
          />
        </div>
        <DialogFooter>
          <DialogClose asChild disabled={isLoading}>
            <Button variant="ghost">{t("Common.cancel")}</Button>
          </DialogClose>
          <Button
            type="submit"
            disabled={isLoading}
            onClick={handleSave}
            variant={"secondary"}
          >
            {isLoading && <Loader className="size-4 animate-spin" />}
            {t("Common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
