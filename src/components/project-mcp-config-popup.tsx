"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ProjectMcpConfig, ProjectMcpConfigRef } from "./project-mcp-config";
import { Button } from "@/components/ui/button";
import { Save, Loader } from "lucide-react";
import { useState, useRef } from "react";

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
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const configRef = useRef<ProjectMcpConfigRef>(null);

  const handleSave = async () => {
    await configRef.current?.save();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-full sm:w-[90vw] md:w-[80vw] lg:w-[70vw] xl:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0">
        <DialogHeader className="p-4 sm:p-6 pb-3 sm:pb-4 border-b flex-shrink-0">
          <DialogTitle>MCP Tools</DialogTitle>
          <DialogDescription>
            Configure which tools are available to this assistant and how they
            behave.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-4 sm:px-6">
          <ProjectMcpConfig
            ref={configRef}
            projectId={projectId}
            onSave={() => onOpenChange(false)}
            onHasChangesUpdate={setHasChanges}
            onSavingStateChange={setSaving}
            renderFooter={false}
          />
        </div>

        <DialogFooter className="p-4 sm:p-6 pt-3 sm:pt-4 border-t flex-shrink-0">
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="gap-2 w-full sm:w-auto"
          >
            {saving ? (
              <Loader className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
