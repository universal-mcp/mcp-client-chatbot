"use client";

import { Bot, Check, PlusCircle, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { selectProjectListByUserIdAction } from "@/app/api/chat/actions";
import { appStore } from "@/app/store";
import { cn } from "lib/utils";
import useSWR from "swr";
import { Button } from "ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "ui/dropdown-menu";
import { Input } from "ui/input";
import { handleErrorWithToast } from "ui/shared-toast";
import { useShallow } from "zustand/shallow";

export function ProjectSelector() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const [selectedProjectForPrompt, appStoreMutate] = appStore(
    useShallow((state) => [state.selectedProjectForPrompt, state.mutate]),
  );

  const { data: projectList = [] } = useSWR(
    "projects",
    selectProjectListByUserIdAction,
    {
      onError: handleErrorWithToast,
      fallbackData: [],
    },
  );

  const selectedProject = projectList.find(
    (project) => project.id === selectedProjectForPrompt,
  );

  const handleProjectSelect = (
    projectId: string | null,
    projectName?: string,
  ) => {
    appStoreMutate((_state) => ({
      selectedProjectForPrompt: projectId,
      selectedProjectName: projectName || null,
    }));
    setOpen(false);
  };

  const handleAddNew = () => {
    router.push("/project/new");
    setOpen(false);
  };

  const buttonText = selectedProject?.name ?? "Default";

  const [searchTerm, setSearchTerm] = useState("");

  const filteredProjects = projectList.filter((project) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "rounded-full font-semibold bg-secondary max-w-[150px] hover:bg-secondary",
            selectedProjectForPrompt &&
              "bg-primary/10 text-primary border-primary/50",
          )}
        >
          <Bot className="size-3.5 hidden sm:block flex-shrink-0" />
          <span className="truncate">{buttonText}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[200px] p-0" align="start">
        <div className="p-2 border-b">
          <div className="flex items-center gap-2 px-2">
            <Search className="size-4 opacity-50" />
            <Input
              placeholder="Search assistant..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-none bg-transparent p-0 h-8 text-sm focus-visible:ring-0"
            />
          </div>
        </div>
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={handleAddNew}
            className="flex items-center gap-2 cursor-pointer"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Add new assistant</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-0" />
          <DropdownMenuItem
            onClick={() => handleProjectSelect(null, undefined)}
            className="flex items-center gap-2"
          >
            <div className="flex items-center gap-2 w-full">
              <div className="w-4 h-4" />
              <span className="text-muted-foreground">Default</span>
              {!selectedProjectForPrompt && (
                <Check className="ml-auto h-4 w-4" />
              )}
            </div>
          </DropdownMenuItem>
          {filteredProjects.length === 0 && searchTerm && (
            <DropdownMenuItem disabled className="text-muted-foreground">
              No assistants found
            </DropdownMenuItem>
          )}
          {filteredProjects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              onClick={() => handleProjectSelect(project.id, project.name)}
              className="flex items-center gap-2"
            >
              <div className="flex items-center gap-2 w-full">
                <Bot className="h-4 w-4" />
                <span className="truncate">{project.name}</span>
                {selectedProjectForPrompt === project.id && (
                  <Check className="ml-auto h-4 w-4" />
                )}
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
