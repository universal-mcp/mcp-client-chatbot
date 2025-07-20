"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "ui/dialog";
import {
  Globe,
  Link as LinkIcon,
  Lock,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { ReactNode, useMemo, useState } from "react";
import { ChatThread } from "app-types/chat";
import { updateThreadVisibilityAction } from "@/app/api/chat/actions";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";
import { Button } from "ui/button";
import { useCopy } from "@/hooks/use-copy";

type Props = {
  thread: ChatThread;
  children: ReactNode;
};

export function ThreadVisibilityDropdown({ thread, children }: Props) {
  const t = useTranslations("Chat.Thread");
  const [isUpdating, setIsUpdating] = useState(false);
  const [updatingTo, setUpdatingTo] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const { mutate } = appStore(
    useShallow((state) => ({ mutate: state.mutate })),
  );
  const { copy, copied } = useCopy();

  const handleUpdateVisibility = async (isPublic: boolean) => {
    setIsUpdating(true);
    setUpdatingTo(isPublic);
    try {
      await updateThreadVisibilityAction(thread.id, isPublic);
      mutate((s) => ({
        threadList: s.threadList.map((t) =>
          t.id === thread.id ? { ...t, isPublic } : t,
        ),
      }));
      toast.success(
        isPublic ? t("threadMadePublicSuccess") : t("threadMadePrivateSuccess"),
      );
    } catch (_error) {
      toast.error(t("failedToUpdateThreadVisibility"));
    } finally {
      setIsUpdating(false);
      setUpdatingTo(null);
    }
  };

  const sharedLink = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/share/${thread.id}`;
  }, [thread.id]);

  const options = useMemo(
    () => [
      {
        value: false,
        label: t("private"),
        icon: <Lock className="size-4" />,
        description: t("privateThreadDescription"),
      },
      {
        value: true,
        label: t("public"),
        icon: <Globe className="size-4" />,
        description: t("publicThreadDescription"),
      },
    ],
    [t],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("shareThreadTitle")}</DialogTitle>
          <DialogDescription>{t("shareThreadDescription")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          {options.map((option) => (
            <div
              key={String(option.value)}
              onClick={() =>
                !isUpdating && handleUpdateVisibility(option.value)
              }
              className={`flex items-center gap-4 p-2 rounded-md ${
                isUpdating
                  ? "cursor-not-allowed opacity-70"
                  : "cursor-pointer hover:bg-muted"
              }`}
            >
              <div
                className={`p-2 rounded-md ${
                  thread.isPublic === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {isUpdating && updatingTo === option.value ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  option.icon
                )}
              </div>
              <div>
                <p className="font-semibold">{option.label}</p>
                <p className="text-xs text-muted-foreground">
                  {option.description}
                </p>
              </div>
              {thread.isPublic === option.value && !isUpdating && (
                <Check className="size-5 ml-auto text-primary" />
              )}
            </div>
          ))}
          {thread.isPublic && (
            <div className="flex items-center gap-2 p-2 border rounded-md">
              <LinkIcon className="size-4" />
              <input
                type="text"
                readOnly
                value={sharedLink}
                className="flex-1 bg-transparent outline-none"
              />
              <Button
                size="icon"
                variant="ghost"
                onClick={() => copy(sharedLink)}
              >
                {copied ? (
                  <Check className="size-4" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
