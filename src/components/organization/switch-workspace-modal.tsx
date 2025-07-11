"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  useListOrganizations,
  useActiveOrganization,
  organization,
} from "@/lib/auth/client";
import { useState } from "react";
import { CreateOrganizationModal } from "./create-organization-modal";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Building2, PlusCircle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwitchWorkspaceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SwitchWorkspaceModal = ({
  open,
  onOpenChange,
}: SwitchWorkspaceModalProps) => {
  const { data: organizations } = useListOrganizations();
  const { data: activeOrganization } = useActiveOrganization();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const onSwitchOrganization = async (orgId: string | null) => {
    // Prevent switching if it's already the active organization
    if (
      (orgId === null && activeOrganization?.id === undefined) ||
      orgId === activeOrganization?.id
    ) {
      onOpenChange(false);
      return;
    }

    try {
      await organization.setActive({ organizationId: orgId });
      // Redirect to home page to refetch all data.
      window.location.href = "/";
    } catch (error) {
      console.error("Failed to switch organization", error);
    }
  };

  const handleOpenCreateModal = () => {
    onOpenChange(false); // Close the switch modal
    setIsCreateModalOpen(true); // Open the create modal
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Switch Workspace</DialogTitle>
            <DialogDescription>
              Select a workspace to switch to, or create a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2">
            {/* Personal Workspace */}
            <button
              onClick={() => onSwitchOrganization(null)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg text-left w-full",
                !activeOrganization?.id
                  ? "bg-accent text-accent-foreground"
                  : "hover:bg-accent/50",
              )}
            >
              <Avatar className="h-8 w-8 rounded-md">
                <AvatarFallback className="rounded-md text-sm bg-primary/10 text-primary">
                  <Building2 className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">Personal</p>
                <p className="text-xs text-muted-foreground">
                  Your personal workspace
                </p>
              </div>
              {!activeOrganization?.id && (
                <CheckCircle className="h-5 w-5 text-green-500" />
              )}
            </button>

            {/* Organization Workspaces */}
            {organizations?.map((org) => (
              <button
                key={org.id}
                onClick={() => onSwitchOrganization(org.id)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg text-left w-full",
                  org.id === activeOrganization?.id
                    ? "bg-accent text-accent-foreground"
                    : "hover:bg-accent/50",
                )}
              >
                <Avatar className="h-8 w-8 rounded-md">
                  <AvatarImage
                    src={org.logo || undefined}
                    className="object-cover"
                  />
                  <AvatarFallback className="rounded-md text-sm bg-primary/10 text-primary">
                    {org.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{org.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Organization workspace
                  </p>
                </div>
                {org.id === activeOrganization?.id && (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                )}
              </button>
            ))}
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleOpenCreateModal}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New Workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Standalone Create Organization Modal */}
      <CreateOrganizationModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
    </>
  );
};
