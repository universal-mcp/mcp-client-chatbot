"use client";

import { Bot, Check, PlusCircle, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "lib/utils";
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

interface ProjectSelectorProps {
  selectedProject?: string | null;
  selectedProjectName?: string | null;
  projectList?: Array<{ id: string; name: string; description: string | null }>;
  onProjectSelect?: (projectId: string | null, projectName?: string) => void;
  disabled?: boolean;
}

export function ProjectSelector({
  selectedProject,
  selectedProjectName,
  projectList = [],
  onProjectSelect,
  disabled = false,
}: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const handleProjectSelect = (
    projectId: string | null,
    projectName?: string,
  ) => {
    onProjectSelect?.(projectId, projectName);
    setOpen(false);
  };

  const handleAddNew = () => {
    router.push("/project/new");
    setOpen(false);
  };

  const buttonText = selectedProjectName ?? "None";

  const [searchTerm, setSearchTerm] = useState("");

  const filteredProjects = projectList.filter((project) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "rounded-full font-semibold bg-secondary max-w-[150px]",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <Bot className="size-3.5 hidden sm:block flex-shrink-0" />
          <span className="truncate">{buttonText}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="md:w-80 p-0" align="start" side="top">
        <div className="p-2 border-b">
          <div className="flex items-center gap-2">
            <Search className="size-4 opacity-50" />
            <Input
              placeholder="Search agent..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-none bg-transparent p-0 h-8 text-sm focus-visible:ring-0"
            />
          </div>
        </div>
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={handleAddNew}
            className="flex items-center gap-2 cursor-pointer py-2"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Add new agent</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator className="my-0" />
          <DropdownMenuItem
            onClick={() => handleProjectSelect(null, undefined)}
            className="flex items-center gap-2"
          >
            <div className="flex items-center gap-2 w-full py-1">
              <Bot className="w-4 h-4 text-blue-400" />
              <span className="text-muted-foreground">None</span>
              {!selectedProject && <Check className="ml-auto h-4 w-4" />}
            </div>
          </DropdownMenuItem>
          {filteredProjects.length === 0 && searchTerm && (
            <DropdownMenuItem disabled className="text-muted-foreground">
              No agents found
            </DropdownMenuItem>
          )}
          {filteredProjects.map((project) => (
            <DropdownMenuItem
              key={project.id}
              onClick={() => handleProjectSelect(project.id, project.name)}
              className="flex items-center gap-2 py-1"
            >
              <div className="flex items-center gap-2 w-full py-1">
                <Bot className="h-4 w-4 text-blue-400" />
                <span className="truncate">{project.name}</span>
                {selectedProject === project.id && (
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
