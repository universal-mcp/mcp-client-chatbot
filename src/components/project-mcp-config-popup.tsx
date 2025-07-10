"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ProjectMcpConfig } from "./project-mcp-config";

interface ProjectMcpConfigPopupProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

export function ProjectMcpConfigPopup({
  isOpen,
  onOpenChange,
  projectId,
}: ProjectMcpConfigPopupProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[50rem] min-w-[50rem] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>MCP Tools</DialogTitle>
          <DialogDescription>
            Configure which tools are available to this assistant and how they
            behave.
          </DialogDescription>
        </DialogHeader>
        <ProjectMcpConfig
          projectId={projectId}
          onSave={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
