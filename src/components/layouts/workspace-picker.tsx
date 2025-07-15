"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Building2, Settings } from "lucide-react";
import { useActiveOrganization } from "@/lib/auth/client";
import { SwitchWorkspaceModal } from "../organization/switch-workspace-modal";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { useRouter } from "next/navigation";

export const WorkspacePicker = () => {
  const { data: activeOrganization } = useActiveOrganization();
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            onClick={() => setIsSwitchModalOpen(true)}
          >
            <Avatar className="h-8 w-8 rounded-md">
              <AvatarImage
                src={activeOrganization?.logo || undefined}
                className="object-cover"
              />
              <AvatarFallback className="rounded-md text-sm bg-primary/10 text-primary">
                {activeOrganization?.name?.charAt(0) || (
                  <Building2 className="h-4 w-4" />
                )}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium truncate flex-1 text-left">
              {activeOrganization?.name || "Personal Workspace"}
            </span>
            <div
              className="ml-auto p-1"
              onClick={(e) => {
                e.stopPropagation();
                router.push("/workspace/settings");
              }}
            >
              <Settings className="h-5 w-5 text-muted-foreground hover:text-foreground" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <SwitchWorkspaceModal
        open={isSwitchModalOpen}
        onOpenChange={setIsSwitchModalOpen}
      />
    </>
  );
};
