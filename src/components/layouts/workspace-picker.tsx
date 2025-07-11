"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Settings, Building2, Replace, ChevronsUpDown } from "lucide-react";
import { useActiveOrganization } from "@/lib/auth/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { SwitchWorkspaceModal } from "../organization/switch-workspace-modal";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";

export const WorkspacePicker = () => {
  const { data: activeOrganization } = useActiveOrganization();
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <div className="p-2 border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
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
                  <ChevronsUpDown className="h-4 w-4 text-muted-foreground ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                sideOffset={8}
                className="w-[--radix-dropdown-menu-trigger-width]"
              >
                <DropdownMenuItem
                  onClick={() => router.push("/workspace/settings")}
                  className="cursor-pointer"
                >
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Workspace Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setIsSwitchModalOpen(true)}
                  className="cursor-pointer"
                >
                  <Replace className="mr-2 h-4 w-4" />
                  <span>Switch Workspace</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </div>

      <SwitchWorkspaceModal
        open={isSwitchModalOpen}
        onOpenChange={setIsSwitchModalOpen}
      />
    </>
  );
};
