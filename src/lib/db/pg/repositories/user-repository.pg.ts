import { User, UserPreferences, UserRepository } from "app-types/user";
import { pgDb as db } from "../db.pg";
import { UserSchema } from "../schema.pg";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/server";

async function getSessionContext() {
  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Unauthorized: No active session");
  }
  return {
    userId: session.user.id,
    organizationId: session.session.activeOrganizationId || null,
  };
}

export const pgUserRepository: UserRepository = {
  existsByEmail: async (email: string): Promise<boolean> => {
    // This function doesn't need session context as it's used for authentication
    const result = await db
      .select()
      .from(UserSchema)
      .where(eq(UserSchema.email, email));
    return result.length > 0;
  },

  updateUser: async (
    id: string,
    user: Pick<User, "name" | "image">,
  ): Promise<User> => {
    const { userId } = await getSessionContext();

    // Ensure users can only update their own profile
    if (userId !== id) {
      throw new Error("Access denied: Can only update your own profile");
    }

    const [result] = await db
      .update(UserSchema)
      .set({
        name: user.name,
        image: user.image,
        updatedAt: new Date(),
      })
      .where(eq(UserSchema.id, id))
      .returning();
    return {
      ...result,
      preferences: result.preferences ?? undefined,
    };
  },

  updatePreferences: async (
    userId: string,
    preferences: UserPreferences,
  ): Promise<User> => {
    const { userId: sessionUserId } = await getSessionContext();

    // Ensure users can only update their own preferences
    if (sessionUserId !== userId) {
      throw new Error("Access denied: Can only update your own preferences");
    }

    const [result] = await db
      .update(UserSchema)
      .set({
        preferences,
        updatedAt: new Date(),
      })
      .where(eq(UserSchema.id, userId))
      .returning();
    return {
      ...result,
      preferences: result.preferences ?? undefined,
    };
  },

  getPreferences: async (userId: string) => {
    const { userId: sessionUserId } = await getSessionContext();

    // Ensure users can only get their own preferences
    if (sessionUserId !== userId) {
      throw new Error("Access denied: Can only access your own preferences");
    }

    const [result] = await db
      .select({ preferences: UserSchema.preferences })
      .from(UserSchema)
      .where(eq(UserSchema.id, userId));
    return result?.preferences ?? null;
  },

  findById: async (userId: string) => {
    const { userId: sessionUserId } = await getSessionContext();

    // Ensure users can only access their own profile
    if (sessionUserId !== userId) {
      throw new Error("Access denied: Can only access your own profile");
    }

    const [result] = await db
      .select()
      .from(UserSchema)
      .where(eq(UserSchema.id, userId));
    return (result as User) ?? null;
  },
};
