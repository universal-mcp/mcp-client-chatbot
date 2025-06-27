"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, Plus, Settings, Building2 } from "lucide-react";
import {
  organization,
  useActiveOrganization,
  useListOrganizations,
} from "@/lib/auth/client";
import { ActiveOrganization, Organization } from "@/lib/auth/types";
import { useEffect, useRef, useState } from "react";
import { appStore } from "@/app/store";
import { CreateOrganizationModal } from "@/components/organization/create-organization-modal";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

export const WorkspacePicker = () => {
  const { data: organizations } = useListOrganizations();
  const { data: activeOrganization } = useActiveOrganization();
  const invalidateOrganizationData = appStore(
    (state) => state.invalidateOrganizationData,
  );
  const previousOrgId = useRef<string | null>(activeOrganization?.id || null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const router = useRouter();

  // Detect organization changes and invalidate SWR data
  useEffect(() => {
    const currentOrgId = activeOrganization?.id || null;

    // Only invalidate if the organization actually changed
    if (previousOrgId.current !== currentOrgId) {
      console.log("Organization changed, invalidating data...", {
        from: previousOrgId.current,
        to: currentOrgId,
      });

      invalidateOrganizationData();
      previousOrgId.current = currentOrgId;
    }
  }, [activeOrganization?.id, invalidateOrganizationData]);

  const handleSwitchOrganization = async (orgId: string | null) => {
    if (orgId === activeOrganization?.id) {
      return;
    }
    await organization.setActive({
      organizationId: orgId,
    });
  };

  return (
    <div className="flex items-center justify-between p-3 border-b bg-sidebar/50 backdrop-blur-sm">
      <div className="flex items-center flex-1 min-w-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 p-2 h-auto justify-start flex-1 min-w-0 hover:bg-sidebar-accent"
            >
              <Avatar className="h-6 w-6 rounded-md">
                <AvatarImage
                  src={activeOrganization?.logo || undefined}
                  className="object-cover"
                />
                <AvatarFallback className="rounded-md text-xs bg-primary/10 text-primary">
                  {activeOrganization?.name?.charAt(0) || (
                    <Building2 className="h-3 w-3" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="text-sm font-medium truncate">
                  {activeOrganization?.name || "Personal"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {activeOrganization?.members?.length || 1} member
                  {(activeOrganization?.members?.length || 1) !== 1 ? "s" : ""}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64" sideOffset={8}>
            {/* Personal Workspace */}
            <DropdownMenuItem
              onClick={() => handleSwitchOrganization(null)}
              className={cn(
                "flex items-center gap-3 p-3 cursor-pointer",
                !activeOrganization?.id && "bg-accent",
              )}
            >
              <Avatar className="h-8 w-8 rounded-md">
                <AvatarFallback className="rounded-md text-sm bg-primary/10 text-primary">
                  <Building2 className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="text-sm font-medium">Personal</span>
                <span className="text-xs text-muted-foreground">
                  Your personal workspace
                </span>
              </div>
            </DropdownMenuItem>

            {/* Organization Workspaces */}
            {organizations?.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => handleSwitchOrganization(org.id)}
                className={cn(
                  "flex items-center gap-3 p-3 cursor-pointer",
                  org.id === activeOrganization?.id && "bg-accent",
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
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{org.name}</span>
                  <span className="text-xs text-muted-foreground">
                    Organization workspace
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1 ml-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-sidebar-accent"
          onClick={() => setIsCreateDialogOpen(true)}
          title="Create new workspace"
        >
          <Plus className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 hover:bg-sidebar-accent"
          onClick={() => router.push("/workspace/settings")}
          title="Workspace settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Create Organization Modal */}
      <CreateOrganizationModal
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
      />
    </div>
  );
};
