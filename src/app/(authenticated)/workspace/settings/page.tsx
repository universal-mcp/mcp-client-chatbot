"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Building2, Users, Settings, Loader } from "lucide-react";
import { useActiveOrganization } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { OrganizationCard } from "@/components/organization/organization-card";
import useSWR from "swr";
import { EditOrganizationModal } from "@/components/organization/edit-organization-modal";
import { CreateOrganizationModal } from "@/components/organization/create-organization-modal";
import { DeleteWorkspaceModal } from "@/components/organization/delete-workspace-modal";

export default function WorkspaceSettingsPage() {
  const { data: activeOrganization } = useActiveOrganization();
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Fetch user role to check admin permissions
  const { data: userRole, isLoading: isLoadingRole } = useSWR(
    "user-role",
    async () => {
      const response = await fetch("/api/user/role");
      if (!response.ok) {
        throw new Error("Failed to fetch user role");
      }
      return response.json();
    },
    {
      revalidateOnFocus: false,
    },
  );

  const isAdmin = userRole?.isAdmin ?? false;

  const handleEditClick = () => {
    if (!isAdmin) {
      toast.error("Only administrators can edit workspace details");
      return;
    }
    setIsEditModalOpen(true);
  };

  const isPersonalWorkspace = !activeOrganization?.id;

  if (isLoadingRole) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <Loader className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/")}
          className="h-8 w-8 p-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Workspace Settings</h1>
        </div>
      </div>

      {/* Workspace Overview - Only show for organization workspaces */}
      {!isPersonalWorkspace && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 rounded-lg">
                <AvatarImage
                  src={activeOrganization?.logo || undefined}
                  className="object-cover"
                />
                <AvatarFallback className="rounded-lg bg-primary/10 text-primary">
                  {activeOrganization?.name?.charAt(0) || (
                    <Building2 className="h-5 w-5" />
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <CardTitle className="flex items-center gap-2">
                  {activeOrganization?.name || "Personal Workspace"}
                  {isPersonalWorkspace && (
                    <Badge variant="secondary" className="text-xs">
                      Personal
                    </Badge>
                  )}
                </CardTitle>
              </div>
              {!isPersonalWorkspace && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEditClick}
                  disabled={!isAdmin}
                  className={!isAdmin ? "opacity-50 cursor-not-allowed" : ""}
                  title={
                    !isAdmin
                      ? "Only administrators can edit workspace details"
                      : ""
                  }
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Edit
                </Button>
              )}
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Organization Management - Only show for non-personal workspaces */}
      {!isPersonalWorkspace && (
        <>
          <Separator />
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" />
                Member Management
              </h2>
            </div>
            <OrganizationCard isAdmin={isAdmin} />
          </div>

          {isAdmin && (
            <>
              <Separator />
              {/* Danger Zone */}
              <div className="space-y-4 rounded-lg border border-destructive/50 p-4">
                <h3 className="text-lg font-semibold text-destructive">
                  Danger Zone
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Delete Workspace</p>
                    <p className="text-sm text-muted-foreground">
                      Permanently delete this workspace and all of its data.
                    </p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setIsDeleteModalOpen(true)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* Personal Workspace Info */}
      {isPersonalWorkspace && (
        <>
          <Separator />
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      Personal Workspace
                    </CardTitle>
                    <CardDescription>
                      Your private space for individual projects and experiments
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold">Ready to collaborate?</h3>
                    <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                      Create a workspace or switch to one to invite team members
                      and work together.
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mt-4"
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Create Workspace
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Create Workspace Modal */}
      <CreateOrganizationModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
      {/* Edit Organization Modal */}
      <EditOrganizationModal
        open={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
      />
      {/* Delete Workspace Modal */}
      {activeOrganization && (
        <DeleteWorkspaceModal
          open={isDeleteModalOpen}
          onOpenChange={setIsDeleteModalOpen}
          workspace={activeOrganization}
        />
      )}
    </div>
  );
}
