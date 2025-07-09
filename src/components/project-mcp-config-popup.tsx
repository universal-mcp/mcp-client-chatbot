"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const handleOpenChange = (open: boolean) => {
    // Allow closing only if there are no unsaved changes
    if (!open && hasUnsavedChanges) {
      // Prevent closing
      return;
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-3xl max-h-[80vh] overflow-y-auto"
        onEscapeKeyDown={(e) => {
          if (hasUnsavedChanges) {
            e.preventDefault();
          }
        }}
        onPointerDownOutside={(e) => {
          if (hasUnsavedChanges) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Configure MCP Tools</DialogTitle>
        </DialogHeader>
        <ProjectMcpConfig
          projectId={projectId}
          onHasChangesUpdate={setHasUnsavedChanges}
        />
      </DialogContent>
    </Dialog>
  );
}
