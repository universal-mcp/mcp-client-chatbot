"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  organization,
  useActiveOrganization,
  useSession,
} from "@/lib/auth/client";
import { ActiveOrganization, OrganizationMember } from "@/lib/auth/types";
import { Loader2, Users, UserPlus, Crown, Shield, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import CopyButton from "@/components/ui/copy-button";
import { InviteMemberDialog } from "@/components/organization/invite-member-dialog";

// --- Org Members ---
function OrgMembers({
  activeOrganization,
  currentMember,
  session,
  isAdmin,
}: {
  activeOrganization: ActiveOrganization | null;
  currentMember: OrganizationMember | undefined;
  session: any;
  isAdmin: boolean;
}) {
  const handleRemoveMember = async (member: OrganizationMember) => {
    if (!isAdmin) {
      toast.error("Only administrators can remove members");
      return;
    }
    if (!activeOrganization?.id) {
      toast.error("Organization not found");
      return;
    }

    await organization.removeMember({
      memberIdOrEmail: member.id,
      organizationId: activeOrganization?.id,
    });
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "owner":
        return <Crown className="h-3 w-3 text-yellow-600" />;
      case "admin":
        return <Shield className="h-3 w-3 text-blue-600" />;
      default:
        return <User className="h-3 w-3 text-gray-500" />;
    }
  };

  const getRoleBadge = (role: string) => {
    const variants = {
      owner:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300",
      admin: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300",
      member:
        "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300",
    };

    return (
      <Badge
        variant="secondary"
        className={`text-xs ${variants[role as keyof typeof variants] || variants.member}`}
      >
        <div className="flex items-center gap-1">
          {getRoleIcon(role)}
          {role}
        </div>
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold text-foreground">Members</h3>
          <Badge variant="outline" className="text-xs">
            {activeOrganization?.members.length || 1}
          </Badge>
        </div>
        {activeOrganization?.id && isAdmin && (
          <InviteMemberDialog
            activeOrganization={activeOrganization}
            isAdmin={isAdmin}
          />
        )}
        {activeOrganization?.id && !isAdmin && (
          <Button
            size="sm"
            className="gap-2"
            variant="secondary"
            disabled
            title="Only administrators can invite members"
          >
            <UserPlus size={14} />
            <p>Invite Member</p>
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {activeOrganization?.members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={member.user.image || undefined}
                  className="object-cover"
                />
                <AvatarFallback className="text-sm">
                  {member.user.name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{member.user.name}</p>
                  {member.userId === session?.user.id && (
                    <Badge variant="outline" className="text-xs">
                      You
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    {member.user.email}
                  </p>
                  {getRoleBadge(member.role)}
                </div>
              </div>
            </div>
            {member.role !== "owner" &&
              (currentMember?.role === "owner" ||
                currentMember?.role === "admin") &&
              isAdmin && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleRemoveMember(member)}
                  className="h-8"
                >
                  {currentMember?.id === member.id ? "Leave" : "Remove"}
                </Button>
              )}
          </div>
        ))}

        {!activeOrganization?.id && (
          <div className="p-3 rounded-lg border bg-card">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={session?.user.image || undefined} />
                <AvatarFallback className="text-sm">
                  {session?.user.name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{session?.user.name}</p>
                  <Badge variant="outline" className="text-xs">
                    You
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    {session?.user.email}
                  </p>
                  {getRoleBadge("owner")}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// --- Invites ---
function Invites({
  activeOrganization,
  isRevoking,
  setIsRevoking,
  inviteVariants,
  isAdmin,
}: {
  activeOrganization: ActiveOrganization | null;
  isRevoking: string[];
  setIsRevoking: (ids: string[]) => void;
  inviteVariants: any;
  isAdmin: boolean;
}) {
  const pendingInvites =
    activeOrganization?.invitations.filter((inv) => inv.status === "pending") ||
    [];

  const handleRevokeInvitation = (invitationId: string) => {
    if (!isAdmin) {
      toast.error("Only administrators can revoke invitations");
      return;
    }

    organization.cancelInvitation(
      {
        invitationId: invitationId,
      },
      {
        onRequest: () => {
          setIsRevoking([...isRevoking, invitationId]);
        },
        onSuccess: () => {
          toast.message("Invitation revoked successfully");
          setIsRevoking(isRevoking.filter((id) => id !== invitationId));
        },
        onError: (ctx) => {
          toast.error(ctx.error.message);
          setIsRevoking(isRevoking.filter((id) => id !== invitationId));
        },
      },
    );
  };

  if (!activeOrganization?.id) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Invitations</h3>
        </div>
        <div className="p-4 rounded-lg border-2 border-dashed border-muted bg-muted/20">
          <p className="text-sm text-muted-foreground text-center">
            Invite members to collaborate in organization workspaces
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">
          Pending Invitations
        </h3>
        <Badge variant="outline" className="text-xs">
          {pendingInvites.length}
        </Badge>
      </div>

      <div className="space-y-3">
        <AnimatePresence>
          {pendingInvites.map((invitation) => (
            <motion.div
              key={invitation.id}
              className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
              variants={inviteVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              layout
            >
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{invitation.email}</p>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">Invited as</p>
                  <Badge variant="secondary" className="text-xs">
                    {invitation.role}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <CopyButton
                  textToCopy={`${process.env.NEXT_PUBLIC_APP_URL}/accept-invitation/${invitation.id}`}
                />
                <Button
                  disabled={isRevoking.includes(invitation.id) || !isAdmin}
                  size="sm"
                  variant="destructive"
                  className="h-8"
                  onClick={() => handleRevokeInvitation(invitation.id)}
                  title={
                    !isAdmin ? "Only administrators can revoke invitations" : ""
                  }
                >
                  {isRevoking.includes(invitation.id) ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    "Revoke"
                  )}
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {pendingInvites.length === 0 && (
          <div className="p-4 rounded-lg border-2 border-dashed border-muted bg-muted/20">
            <p className="text-sm text-muted-foreground text-center">
              No pending invitations
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function OrganizationCard({ isAdmin }: { isAdmin: boolean }) {
  const { data: activeOrganization } = useActiveOrganization() as {
    data: ActiveOrganization | null;
  };
  const [isRevoking, setIsRevoking] = useState<string[]>([]);
  const inviteVariants = {
    hidden: { opacity: 0, height: 0 },
    visible: { opacity: 1, height: "auto" },
    exit: { opacity: 0, height: 0 },
  };

  const { data: session } = useSession();

  const currentMember = activeOrganization?.members.find(
    (member) => member.userId === session?.user.id,
  );

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="space-y-6">
        <OrgMembers
          activeOrganization={activeOrganization}
          currentMember={currentMember}
          session={session}
          isAdmin={isAdmin}
        />

        <Separator />

        <Invites
          activeOrganization={activeOrganization}
          isRevoking={isRevoking}
          setIsRevoking={setIsRevoking}
          inviteVariants={inviteVariants}
          isAdmin={isAdmin}
        />
      </CardContent>
    </Card>
  );
}
