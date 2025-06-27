"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Building2, Users, Settings, Save } from "lucide-react";
import { useActiveOrganization, organization } from "@/lib/auth/client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { OrganizationCard } from "@/components/organization/organization-card";
import { CreateOrganizationModal } from "@/components/organization/create-organization-modal";

export default function WorkspaceSettingsPage() {
  const { data: activeOrganization } = useActiveOrganization();
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(activeOrganization?.name || "");
  const [loading, setLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const handleSave = async () => {
    if (!activeOrganization?.id) {
      toast.error("Cannot update personal workspace name");
      return;
    }

    setLoading(true);
    await organization.update(
      {
        organizationId: activeOrganization.id,
        data: {
          name: name.trim(),
        },
      },
      {
        onResponse: () => {
          setLoading(false);
        },
        onSuccess: () => {
          toast.success("Workspace updated successfully");
          setIsEditing(false);
        },
        onError: (_error) => {
          toast.error("Failed to update workspace");
          setLoading(false);
        },
      },
    );
  };

  const isPersonalWorkspace = !activeOrganization?.id;

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
                  onClick={() => setIsEditing(!isEditing)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  {isEditing ? "Cancel" : "Edit"}
                </Button>
              )}
            </div>
          </CardHeader>

          {!isPersonalWorkspace && isEditing && (
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="workspace-name">Workspace Name</Label>
                <div className="flex gap-2">
                  <Input
                    id="workspace-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter workspace name"
                  />
                  <Button
                    onClick={handleSave}
                    disabled={
                      loading ||
                      !name.trim() ||
                      name === activeOrganization?.name
                    }
                    size="sm"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          )}
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
            <OrganizationCard />
          </div>
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
                      Create an organization workspace to invite team members
                      and work together on projects.
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="mt-4"
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Create Organization
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Create Organization Modal */}
      <CreateOrganizationModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
      />
    </div>
  );
}
