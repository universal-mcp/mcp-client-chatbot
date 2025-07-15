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
import { Building2, PlusCircle, CheckCircle, Loader2 } from "lucide-react";
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
  const [switchingTo, setSwitchingTo] = useState<string | "personal" | null>(
    null,
  );

  const onSwitchOrganization = async (orgId: string | null) => {
    // Prevent switching if it's already the active organization
    if (
      (orgId === null && activeOrganization?.id === undefined) ||
      orgId === activeOrganization?.id
    ) {
      onOpenChange(false);
      return;
    }

    setSwitchingTo(orgId ?? "personal");
    try {
      await organization.setActive({ organizationId: orgId });
      window.location.href = "/";
    } catch (error) {
      console.error("Failed to switch organization", error);
      setSwitchingTo(null);
    }
  };

  const handleOpenCreateModal = () => {
    onOpenChange(false);
    setIsCreateModalOpen(true);
  };

  const activeWorkspaceName =
    organizations?.find((org) => org.id === activeOrganization?.id)?.name ??
    "Personal";

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={switchingTo !== null ? () => {} : onOpenChange}
      >
        <DialogContent className="sm:max-w-md">
          {switchingTo && (
            <div className="absolute inset-0 z-50 flex items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-10 w-10 animate-spin" />
                <p className="text-sm text-muted-foreground">
                  Switching workspace...
                </p>
              </div>
            </div>
          )}
          <DialogHeader>
            <DialogTitle>Switch Workspace</DialogTitle>
            <DialogDescription>
              You are currently in{" "}
              <strong className="break-all">{activeWorkspaceName}</strong>.
              Select a new workspace to switch to.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 max-h-[400px] overflow-y-auto overflow-x-hidden pr-2 w-full">
            {/* Personal Workspace */}
            <div
              key="personal"
              onClick={() => switchingTo === null && onSwitchOrganization(null)}
              className={cn(
                "flex cursor-pointer items-center rounded-lg border p-3 transition-colors",
                !activeOrganization?.id
                  ? "border-primary"
                  : "hover:bg-muted/50",
                switchingTo !== null && "cursor-not-allowed opacity-50",
              )}
            >
              <Avatar className="h-9 w-9 rounded-md">
                <AvatarFallback className="rounded-md bg-muted text-muted-foreground">
                  <Building2 className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="ml-4 flex-grow min-w-0 overflow-hidden">
                <p className="font-semibold truncate">Personal</p>
                <p className="text-sm text-muted-foreground">
                  Your personal workspace
                </p>
              </div>
              {!activeOrganization?.id && (
                <CheckCircle className="h-5 w-5 text-primary" />
              )}
            </div>

            {/* Organization Workspaces */}
            {organizations?.map((org) => (
              <div
                key={org.id}
                onClick={() =>
                  switchingTo === null && onSwitchOrganization(org.id)
                }
                className={cn(
                  "flex cursor-pointer items-center rounded-lg border p-3 transition-colors",
                  org.id === activeOrganization?.id
                    ? "border-primary"
                    : "hover:bg-muted/50",
                  switchingTo !== null && "cursor-not-allowed opacity-50",
                )}
              >
                <Avatar className="h-9 w-9 rounded-md">
                  <AvatarImage
                    src={org.logo || undefined}
                    className="object-cover"
                  />
                  <AvatarFallback className="rounded-md bg-muted font-semibold">
                    {org.name?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="ml-4 flex-grow min-w-0 overflow-hidden">
                  <p className="font-semibold truncate">{org.name}</p>
                  <p className="text-sm text-muted-foreground">
                    Organization workspace
                  </p>
                </div>
                {org.id === activeOrganization?.id && (
                  <CheckCircle className="h-5 w-5 text-primary" />
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleOpenCreateModal}
              disabled={switchingTo !== null}
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
