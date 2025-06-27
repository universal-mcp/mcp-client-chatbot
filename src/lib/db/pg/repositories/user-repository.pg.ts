import { User, UserPreferences, UserRepository } from "app-types/user";
import { pgDb as db } from "../db.pg";
import { UserSchema } from "../schema.pg";
import { eq } from "drizzle-orm";

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
    const [result] = await db
      .select({ preferences: UserSchema.preferences })
      .from(UserSchema)
      .where(eq(UserSchema.id, userId));
    return result?.preferences ?? null;
  },

  findById: async (userId: string) => {
    const [result] = await db
      .select()
      .from(UserSchema)
      .where(eq(UserSchema.id, userId));
    return (result as User) ?? null;
  },
};
