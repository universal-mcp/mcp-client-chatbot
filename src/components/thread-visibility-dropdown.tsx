"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";
import { Globe, Lock } from "lucide-react";
import { ReactNode, useMemo, useState } from "react";
import { ChatThread } from "app-types/chat";
import { updateThreadAction } from "@/app/api/chat/actions";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { appStore } from "@/app/store";
import { useShallow } from "zustand/shallow";

type Props = {
  thread: ChatThread;
  children: ReactNode;
};
export function ThreadVisibilityDropdown({ thread, children }: Props) {
  const t = useTranslations("Chat.Thread");
  const [isUpdating, setIsUpdating] = useState(false);
  const { mutate } = appStore(
    useShallow((state) => ({ mutate: state.mutate })),
  );

  const handleUpdateVisibility = async (isPublic: boolean) => {
    setIsUpdating(true);
    try {
      await updateThreadAction(thread.id, { isPublic });
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
    }
  };

  const options = useMemo(
    () => [
      {
        value: true,
        label: t("public"),
        icon: <Globe className="size-4" />,
        description: t("publicThreadDescription"),
      },
      {
        value: false,
        label: t("private"),
        icon: <Lock className="size-4" />,
        description: t("privateThreadDescription"),
      },
    ],
    [t],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent>
        {options.map((option) => (
          <DropdownMenuItem
            key={String(option.value)}
            onClick={() => handleUpdateVisibility(option.value)}
            disabled={isUpdating || thread.isPublic === option.value}
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                {option.icon}
                <span>{option.label}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {option.description}
              </p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
