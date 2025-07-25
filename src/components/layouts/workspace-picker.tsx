"use client";

import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Building2,
  Settings,
  CheckCircle,
  PlusCircle,
  Loader2,
  ChevronDown,
} from "lucide-react";
import {
  useActiveOrganization,
  useListOrganizations,
  organization,
} from "@/lib/auth/client";
import { CreateOrganizationModal } from "../organization/create-organization-modal";
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Skeleton } from "../ui/skeleton";

export const WorkspacePicker = () => {
  const { data: activeOrganization, isPending: isLoading } =
    useActiveOrganization();
  const { data: organizations } = useListOrganizations();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [switchingTo, setSwitchingTo] = useState<string | "personal" | null>(
    null,
  );
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const t = useTranslations("Layout");

  const onSwitchOrganization = async (orgId: string | null) => {
    if (
      (orgId === null && !activeOrganization?.id) ||
      orgId === activeOrganization?.id
    ) {
      setIsOpen(false);
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
    setIsOpen(false);
    setIsCreateModalOpen(true);
  };

  const handleOpenSettings = () => {
    if (!activeOrganization?.id) return;
    setIsOpen(false);
    router.push("/workspace/settings");
  };

  return (
    <>
      <DropdownMenu
        open={isOpen}
        onOpenChange={(open) => !switchingTo && setIsOpen(open)}
      >
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              >
                {isLoading ? (
                  <>
                    <Skeleton className="h-8 w-8 rounded-md" />
                  </>
                ) : (
                  <>
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
                      {activeOrganization?.name || t("personalWorkspace")}
                    </span>
                  </>
                )}
                <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
          </SidebarMenuItem>
        </SidebarMenu>
        <DropdownMenuContent
          side="bottom"
          align="center"
          className="bg-background w-60 rounded-lg p-1.5"
        >
          <div className="relative">
            {switchingTo && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-md bg-background/80 backdrop-blur-sm">
                <Loader2 className="h-6 w-6 animate-spin" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Switching...
                </p>
              </div>
            )}
            <div className="max-h-[250px] overflow-y-auto -mr-1 pr-1">
              {/* Personal Workspace */}
              <DropdownMenuItem
                key="personal"
                onClick={() => onSwitchOrganization(null)}
                disabled={switchingTo !== null}
                className={cn(
                  "cursor-pointer p-2",
                  !activeOrganization?.id && "bg-muted",
                )}
              >
                <Avatar className="h-8 w-8 rounded-md mr-2.5">
                  <AvatarFallback className="rounded-md bg-muted text-muted-foreground">
                    <Building2 className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-grow min-w-0 overflow-hidden">
                  <p className="font-semibold truncate text-sm">
                    {t("personal")}
                  </p>
                </div>
                {!activeOrganization?.id && (
                  <CheckCircle className="ml-auto h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>

              {/* Organization Workspaces */}
              {organizations?.map((org) => (
                <DropdownMenuItem
                  key={org.id}
                  onClick={() => onSwitchOrganization(org.id)}
                  disabled={switchingTo !== null}
                  className={cn(
                    "cursor-pointer p-2",
                    org.id === activeOrganization?.id && "bg-muted",
                  )}
                >
                  <Avatar className="h-8 w-8 rounded-md mr-2.5">
                    <AvatarImage
                      src={org.logo || undefined}
                      className="object-cover"
                    />
                    <AvatarFallback className="rounded-md bg-muted font-semibold text-sm">
                      {org.name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-grow min-w-0 overflow-hidden">
                    <p className="font-semibold truncate text-sm">{org.name}</p>
                  </div>
                  {org.id === activeOrganization?.id && (
                    <CheckCircle className="ml-auto h-4 w-4 text-primary" />
                  )}
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator className="my-1.5" />
            <DropdownMenuItem
              onClick={handleOpenSettings}
              disabled={switchingTo !== null || !activeOrganization?.id}
              className="cursor-pointer p-2"
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>{t("workspaceSettings")}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleOpenCreateModal}
              disabled={switchingTo !== null}
              className="cursor-pointer p-2"
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              <span>{t("createNewWorkspace")}</span>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateOrganizationModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        switchToNewWorkspace={false}
      />
    </>
  );
};
