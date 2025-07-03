"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MailPlus } from "lucide-react";
import { toast } from "sonner";
import { organization } from "@/lib/auth/client";
import { ActiveOrganization } from "@/lib/auth/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const InviteMemberDialog = ({
  activeOrganization,
  isAdmin,
}: {
  activeOrganization: ActiveOrganization | null;
  isAdmin: boolean;
}) => {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");

  const handleInvite = async () => {
    if (!isAdmin) {
      toast.error("Only administrators can invite members");
      return;
    }

    const invite = organization.inviteMember({
      email: email,
      role: role as "member",
      organizationId: activeOrganization?.id,
    });
    toast.promise(invite, {
      loading: "Inviting member...",
      success: "Member invited successfully",
      error: (error) => error.error.message,
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2" variant="secondary">
          <MailPlus size={14} />
          <p>Invite Member</p>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] w-11/12">
        <DialogHeader>
          <DialogTitle>Invite Member</DialogTitle>
          <DialogDescription>
            Invite a member to your organization.
            {!isAdmin && (
              <div className="mt-2 text-sm text-destructive">
                Only administrators can invite members.
              </div>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label>Email</Label>
          <Input
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!isAdmin}
          />
          <Label>Role</Label>
          <Select value={role} onValueChange={setRole} disabled={!isAdmin}>
            <SelectTrigger>
              <SelectValue placeholder="Select a role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button
              disabled={!email || !role || !isAdmin}
              onClick={handleInvite}
            >
              Invite
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
