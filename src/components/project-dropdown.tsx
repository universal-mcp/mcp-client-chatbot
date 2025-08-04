"use client";
import {
  deleteProjectAction,
  updateProjectNameAction,
} from "@/app/api/chat/actions";
import { appStore } from "@/app/store";
import { Project } from "app-types/chat";
import { AudioWaveformIcon, Loader, PencilLine, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { type PropsWithChildren, useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import { safe } from "ts-safe";
import { Button } from "ui/button";
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "ui/dialog";

import { Input } from "ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "ui/popover";
import { useTranslations } from "next-intl";
import { useShallow } from "zustand/shallow";
import { generateUUID } from "lib/utils";

type Props = PropsWithChildren<{
  project: Pick<Project, "id" | "name">;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "end" | "center";
}>;

export function ProjectDropdown({ project, children, side, align }: Props) {
  const router = useRouter();
  const t = useTranslations();
  const [currentProjectId, appStoreMutate] = appStore(
    useShallow((state) => [state.currentProjectId, state.mutate]),
  );

  const [open, setOpen] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    safe()
      .watch(() => setIsDeleting(true))
      .ifOk(() => deleteProjectAction(project.id))
      .watch(() => setIsDeleting(false))
      .watch(({ isOk, error }) => {
        if (isOk) {
          toast.success(t("Chat.Project.projectDeleted"));
        } else {
          toast.error(error.message || t("Chat.Project.failedToDeleteProject"));
        }
      })
      .ifOk(() => {
        if (currentProjectId === project.id) {
          router.push("/");
        }
        mutate("/api/thread/list");
        mutate("/api/project/list");
      })
      .unwrap();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="p-0 w-[220px]" side={side} align={align}>
        <Command>
          <div className="flex items-center gap-2 px-2 py-1 text-sm pt-2 font-semibold">
            {t("Chat.Project.project")}
          </div>
          <CommandSeparator />
          <CommandList>
            <CommandGroup>
              <CommandItem className="cursor-pointer p-0">
                <div
                  className="flex items-center gap-2 w-full px-2 py-1 rounded"
                  onClick={(e) => {
                    e.stopPropagation();
                    appStoreMutate((state) => ({
                      voiceChat: {
                        ...state.voiceChat,
                        isOpen: true,
                        threadId: generateUUID(),
                        projectId: project.id,
                      },
                    }));
                  }}
                >
                  <AudioWaveformIcon className="text-foreground" />
                  <span>{t("Chat.VoiceChat.title")}</span>
                </div>
              </CommandItem>
              <CommandItem className="cursor-pointer p-0">
                <UpdateProjectNameDialog
                  initialName={project.name}
                  onUpdated={() => setOpen(false)}
                  projectId={project.id}
                >
                  <div
                    className="flex items-center gap-2 w-full px-2 py-1 rounded"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <PencilLine className="text-foreground" />
                    {t("Chat.Project.renameProject")}
                  </div>
                </UpdateProjectNameDialog>
              </CommandItem>

              <CommandItem disabled={isDeleting} className="cursor-pointer p-0">
                <div
                  className="flex items-center gap-2 w-full px-2 py-1 rounded"
                  onClick={handleDelete}
                >
                  <Trash className="text-destructive" />
                  <span className="text-destructive">
                    {t("Chat.Project.deleteProject")}
                  </span>
                  {isDeleting && (
                    <Loader className="ml-auto h-4 w-4 animate-spin" />
                  )}
                </div>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function UpdateProjectNameDialog({
  initialName,
  children,
  onUpdated,
  projectId,
}: PropsWithChildren<{
  initialName: string;
  onUpdated: (name: string) => void;
  projectId: string;
}>) {
  const t = useTranslations();
  const [isUpdating, setIsUpdating] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(initialName);

  const handleUpdate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsUpdating(true);
    return safe(() => updateProjectNameAction(projectId, name))

      .watch(({ isOk, error }) => {
        setIsUpdating(false);
        setIsOpen(false);
        if (isOk) {
          onUpdated(name);
          mutate("/api/project/list");
          mutate(`/projects/${projectId}`);
          toast.success(t("Chat.Project.projectUpdated"));
        } else {
          toast.error(error.message || t("Chat.Project.failedToUpdateProject"));
        }
      })
      .unwrap();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent hideClose onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{t("Chat.Project.renameProject")}</DialogTitle>
        </DialogHeader>
        <DialogDescription>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </DialogDescription>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="secondary" onClick={(e) => e.stopPropagation()}>
              {t("Common.cancel")}
            </Button>
          </DialogClose>

          <Button variant="outline" onClick={handleUpdate}>
            {isUpdating ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              t("Common.update")
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
