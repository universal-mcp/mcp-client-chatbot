import { getSession } from "@/lib/auth/server";
import { pgDb as db } from "@/lib/db/pg/db.pg";
import { MemberSchema } from "@/lib/db/pg/schema.pg";
import { UUID } from "crypto";
import { and, eq } from "drizzle-orm";

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

export async function checkAdminPermission(
  userId: string,
  organizationId: string | null,
) {
  // In personal mode, user is always admin
  if (!organizationId) {
    return true;
  }

  // In organization mode, check if user is admin or owner
  const [member] = await db
    .select()
    .from(MemberSchema)
    .where(
      and(
        eq(MemberSchema.userId, userId),
        eq(MemberSchema.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!member) {
    throw new Error("User is not a member of this organization");
  }

  if (member.role !== "admin" && member.role !== "owner") {
    throw new Error("Only organization admins can manage MCP servers");
  }

  return true;
}
