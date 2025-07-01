import { NextResponse } from "next/server";
import { checkAdminPermission } from "@/lib/auth/session-context";

export async function GET() {
  try {
    // Check if user has admin permissions
    let isAdmin = false;
    try {
      isAdmin = await checkAdminPermission();
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
