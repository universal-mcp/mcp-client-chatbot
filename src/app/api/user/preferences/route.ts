import { UserPreferencesZodSchema } from "app-types/user";
import { userRepository } from "lib/db/repository";
import { NextResponse } from "next/server";
import { getSessionContext } from "@/lib/auth/session-context";

export async function GET() {
  try {
    const { userId } = await getSessionContext();

    const preferences = await userRepository.getPreferences(userId);
    return NextResponse.json(preferences ?? {});
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to get preferences" },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  try {
    const { userId } = await getSessionContext();

    const json = await request.json();
    const preferences = UserPreferencesZodSchema.parse(json);
    const updatedUser = await userRepository.updatePreferences(
      userId,
      preferences,
    );
    return NextResponse.json({
      success: true,
      preferences: updatedUser.preferences,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to update preferences" },
      { status: 500 },
    );
  }
}
