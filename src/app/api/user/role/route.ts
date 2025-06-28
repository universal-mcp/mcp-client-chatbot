import { NextResponse } from "next/server";
import {
  getSessionContext,
  checkAdminPermission,
} from "@/lib/auth/session-context";

export async function GET() {
  try {
    const { userId, organizationId } = await getSessionContext();

    // Check if user has admin permissions
    let isAdmin = false;
    try {
      isAdmin = await checkAdminPermission(userId, organizationId);
    } catch (_error) {
      // If checkAdminPermission throws an error, user is not admin
      isAdmin = false;
    }

    return NextResponse.json({
      isAdmin,
      role: isAdmin ? "admin" : "member",
    });
  } catch (_error) {
    return NextResponse.json(
      { error: "Failed to get user role" },
      { status: 500 },
    );
  }
}
