"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  organization,
  useActiveOrganization,
  useListOrganizations,
  useSession,
} from "@/lib/auth/client";
import { ActiveOrganization, OrganizationMember } from "@/lib/auth/types";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import CopyButton from "@/components/ui/copy-button";
import { CreateOrganizationDialog } from "@/components/organization/create-organization-dialog";
import { InviteMemberDialog } from "@/components/organization/invite-member-dialog";
import { OrganizationSwitcher } from "@/components/organization/organization-switcher";

// --- Organization Details ---
function OrganizationDetails({
  activeOrganization,
}: {
  activeOrganization: ActiveOrganization | null;
}) {
  return (
    <>
      <div className="flex items-center gap-2 mt-4">
        <Avatar className="rounded-none w-12 h-12">
          <AvatarImage
            className="object-cover w-full h-full rounded-none"
            src={activeOrganization?.logo || undefined}
          />
          <AvatarFallback className="rounded-none">
            {activeOrganization?.name?.charAt(0) || "P"}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-base font-semibold text-foreground">
            {activeOrganization?.name || "Personal"}
          </p>
          <p className="text-xs text-muted-foreground">
            {activeOrganization?.members.length || 1} members
          </p>
        </div>
      </div>
    </>
  );
}

// --- Org Members ---
function OrgMembers({
  activeOrganization,
  currentMember,
  session,
}: {
  activeOrganization: ActiveOrganization | null;
  currentMember: OrganizationMember | undefined;
  session: any;
}) {
  const handleRemoveMember = async (member: OrganizationMember) => {
    await organization.removeMember({
      memberIdOrEmail: member.id,
    });
  };
  return (
    <div className="flex flex-col gap-4 flex-grow">
      <p className="text-sm font-semibold text-foreground mb-1">Members</p>
      <div className="flex flex-col gap-2">
        {activeOrganization?.members.map((member) => (
          <div key={member.id} className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Avatar className="sm:flex w-9 h-9">
                <AvatarImage
                  src={member.user.image || undefined}
                  className="object-cover"
                />
                <AvatarFallback>{member.user.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm">{member.user.name}</p>
                <p className="text-xs text-muted-foreground">{member.role}</p>
              </div>
            </div>
            {member.role !== "owner" &&
              (currentMember?.role === "owner" ||
                currentMember?.role === "admin") && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleRemoveMember(member)}
                >
                  {currentMember?.id === member.id ? "Leave" : "Remove"}
                </Button>
              )}
          </div>
        ))}
        {!activeOrganization?.id && (
          <div>
            <div className="flex items-center gap-2">
              <Avatar>
                <AvatarImage src={session?.user.image || undefined} />
                <AvatarFallback>{session?.user.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm">{session?.user.name}</p>
                <p className="text-xs text-muted-foreground">Owner</p>
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
}: {
  activeOrganization: ActiveOrganization | null;
  isRevoking: string[];
  setIsRevoking: (ids: string[]) => void;
  inviteVariants: any;
}) {
  const pendingInvites =
    activeOrganization?.invitations.filter((inv) => inv.status === "pending") ||
    [];
  return (
    <div className="flex flex-col gap-4 flex-grow">
      <p className="text-sm font-semibold text-foreground mb-1">Invites</p>
      <div className="flex flex-col gap-2">
        <AnimatePresence>
          {pendingInvites.map((invitation) => (
            <motion.div
              key={invitation.id}
              className="flex items-center justify-between"
              variants={inviteVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              layout
            >
              <div>
                <p className="text-sm">{invitation.email}</p>
                <p className="text-xs text-muted-foreground">
                  {invitation.role}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  disabled={isRevoking.includes(invitation.id)}
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    organization.cancelInvitation(
                      {
                        invitationId: invitation.id,
                      },
                      {
                        onRequest: () => {
                          setIsRevoking([...isRevoking, invitation.id]);
                        },
                        onSuccess: () => {
                          toast.message("Invitation revoked successfully");
                          setIsRevoking(
                            isRevoking.filter((id) => id !== invitation.id),
                          );
                        },
                        onError: (ctx) => {
                          toast.error(ctx.error.message);
                          setIsRevoking(
                            isRevoking.filter((id) => id !== invitation.id),
                          );
                        },
                      },
                    );
                  }}
                >
                  {isRevoking.includes(invitation.id) ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    "Revoke"
                  )}
                </Button>
                <div>
                  <CopyButton
                    textToCopy={`${process.env.NEXT_PUBLIC_APP_URL}/accept-invitation/${invitation.id}`}
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {(activeOrganization?.invitations.length === 0 ||
          pendingInvites.length === 0) && (
          <motion.p
            className="text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            No Active Invitations
          </motion.p>
        )}
        {!activeOrganization?.id && (
          <Label className="text-xs text-muted-foreground">
            You can&apos;t invite members to your personal workspace.
          </Label>
        )}
      </div>
    </div>
  );
}

export function OrganizationCard() {
  const { data: organizations } = useListOrganizations();
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
    <Card>
      <CardHeader>
        <CardTitle className="text-lg md:text-xl font-bold text-foreground">
          Organization
        </CardTitle>
        <div className="flex justify-between items-center mt-2">
          <OrganizationSwitcher
            activeOrganization={activeOrganization as ActiveOrganization}
            organizations={organizations || []}
          />
          <div>
            <CreateOrganizationDialog />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <OrganizationDetails activeOrganization={activeOrganization} />
        <div className="flex gap-8 flex-col md:flex-row">
          <OrgMembers
            activeOrganization={activeOrganization}
            currentMember={currentMember}
            session={session}
          />
          <Invites
            activeOrganization={activeOrganization}
            isRevoking={isRevoking}
            setIsRevoking={setIsRevoking}
            inviteVariants={inviteVariants}
          />
        </div>
        <div className="flex justify-end w-full mt-4">
          <div>
            <div>
              {activeOrganization?.id && (
                <InviteMemberDialog activeOrganization={activeOrganization} />
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
