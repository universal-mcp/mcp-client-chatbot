"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { organization } from "@/lib/auth/client";
import { Organization } from "@/lib/auth/types";

interface DeleteWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: Omit<Organization, "members"> & { members: { id: string }[] };
}

export const DeleteWorkspaceModal = ({
  open,
  onOpenChange,
  workspace,
}: DeleteWorkspaceModalProps) => {
  const [confirmation, setConfirmation] = useState("");
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (loading || confirmation !== workspace.name) return;

    setLoading(true);

    await organization.delete(
      {
        organizationId: workspace.id,
      },
      {
        onResponse: () => {
          setLoading(false);
        },
        onSuccess: () => {
          toast.success("Workspace deleted successfully");
          onOpenChange(false);
          // Refresh the page to reflect the change
          window.location.href = "/";
        },
        onError: (error) => {
          toast.error(error.error.message);
          setLoading(false);
        },
      },
    );
  };

  const memberCount = workspace.members?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Delete Workspace
          </DialogTitle>
          <DialogDescription>
            This action is irreversible and will permanently delete the{" "}
            <b className="break-all">{workspace.name}</b> workspace.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {memberCount > 1 && (
            <div className="bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-3 text-sm">
              This workspace has <b>{memberCount} members</b>. Deleting the
              workspace will remove access for everyone.
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="confirmation">
              To confirm, please type{" "}
              <b className="break-all">{workspace.name}</b> below:
            </Label>
            <Input
              id="confirmation"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              autoComplete="off"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={loading || confirmation !== workspace.name}
            onClick={handleDelete}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin mr-2" size={16} />
                Deleting...
              </>
            ) : (
              "Delete Workspace"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
