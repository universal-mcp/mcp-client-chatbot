import { getActiveMember, getSession } from "@/lib/auth/server";
import { UUID } from "crypto";

export async function getSessionContext() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized: No active session");
  }

  return {
    userId: session.user.id as UUID,
    organizationId: session.session.activeOrganizationId as UUID,
    user: session.user,
  };
}

export async function checkAdminPermission() {
  const { organizationId } = await getSessionContext();
  // In personal mode, user is always admin
  if (!organizationId) {
    return true;
  }

  // In organization mode, check if user is admin or owner
  const member = await getActiveMember();

  if (!member) {
    throw new Error("User is not a member of this organization");
  }

  if (member.role !== "admin" && member.role !== "owner") {
    throw new Error("Only organization admins can manage MCP servers");
  }

  return true;
}
