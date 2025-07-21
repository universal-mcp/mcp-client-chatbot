import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "crypto";
import { cookies } from "next/headers";
import logger from "@/lib/logger";
import { pgMcpOAuthStateRepository } from "@/lib/db/pg/repositories/mcp-repository.pg";
import type { McpOAuthStateEntity } from "@/lib/db/pg/schema.pg";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const OAUTH_STATE_COOKIE = "mcp_oauth_state";
const STATE_EXPIRY_MINUTES = 15;

export type OAuthState = McpOAuthStateEntity;

export class OAuthStateManager {
  private static encryptionKey: Buffer;

  static {
    const key = process.env.OAUTH_STATE_ENCRYPTION_KEY;
    if (!key || key.length !== 64) {
      if (process.env.NODE_ENV === "production") {
        logger.error(
          "FATAL: OAUTH_STATE_ENCRYPTION_KEY is not set or is invalid in production. It must be a 64-character hex string.",
        );
        throw new Error(
          "OAUTH_STATE_ENCRYPTION_KEY is not set or is invalid in production.",
        );
      } else {
        logger.warn(
          "WARNING: Using a default, insecure OAUTH_STATE_ENCRYPTION_KEY for development.",
        );
        logger.warn(
          "Generate a new key with: openssl rand -hex 32 and set it in your .env file",
        );
        this.encryptionKey = createHash("sha256")
          .update("wingmen-client-default-dev-key")
          .digest();
      }
    } else {
      this.encryptionKey = Buffer.from(key, "hex");
    }
  }

  private static encrypt(text: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(text, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString("hex")}.${authTag.toString("hex")}.${encrypted.toString("hex")}`;
  }

  private static decrypt(encryptedData: string): string | null {
    try {
      const parts = encryptedData.split(".");
      if (parts.length !== 3) return null;
      const [iv, authTag, encrypted] = parts.map((p) => Buffer.from(p, "hex"));
      const decipher = createDecipheriv(
        ENCRYPTION_ALGORITHM,
        this.encryptionKey,
        iv,
      );
      decipher.setAuthTag(authTag);
      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString("utf8");
    } catch (error) {
      logger.error("Failed to decrypt OAuth state", { error });
      return null;
    }
  }

  static async storeState(
    state: Omit<OAuthState, "id" | "createdAt" | "expiresAt">,
  ): Promise<string> {
    const stateId = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + STATE_EXPIRY_MINUTES * 60 * 1000);
    const oauthState: OAuthState = {
      id: stateId,
      createdAt: new Date(),
      expiresAt,
      ...state,
    };

    await pgMcpOAuthStateRepository.save(oauthState);
    const encryptedStateId = this.encrypt(stateId);

    // @ts-expect-error - Linter has issues with Next.js cookies() in this context
    cookies().set(OAUTH_STATE_COOKIE, encryptedStateId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: STATE_EXPIRY_MINUTES * 60,
      path: "/",
    });

    logger.info(`Stored OAuth state for server: ${state.serverName}`);
    return stateId;
  }

  static async getState(publicStateId: string): Promise<OAuthState | null> {
    // @ts-expect-error - Linter has issues with Next.js cookies() in this context
    const encryptedStateId = cookies().get(OAUTH_STATE_COOKIE)?.value;

    if (!encryptedStateId) {
      logger.warn("No OAuth state cookie found.");
      return null;
    }

    const stateId = this.decrypt(encryptedStateId);
    if (!stateId) return null;

    if (publicStateId !== stateId) {
      logger.error(
        "Public state ID does not match stored state ID. CSRF attempt?",
      );
      return null;
    }

    const state = await pgMcpOAuthStateRepository.findById(stateId);

    if (!state || new Date() > state.expiresAt) {
      logger.warn("OAuth state not found or expired in database.");
      await this.clearState();
      return null;
    }
    return state;
  }

  static async clearState(): Promise<void> {
    // @ts-expect-error - Linter has issues with Next.js cookies() in this context
    const encryptedStateId = cookies().get(OAUTH_STATE_COOKIE)?.value;
    if (encryptedStateId) {
      const stateId = this.decrypt(encryptedStateId);
      if (stateId) {
        await pgMcpOAuthStateRepository.deleteById(stateId);
      }
    }
    // @ts-expect-error - Linter has issues with Next.js cookies() in this context
    cookies().delete(OAUTH_STATE_COOKIE);
    logger.info("Cleared OAuth state.");
  }

  static async cleanupExpiredStates(): Promise<void> {
    const result = await pgMcpOAuthStateRepository.cleanupExpired();
    if (result.rowCount && result.rowCount > 0) {
      logger.info(`Cleaned up ${result.rowCount} expired OAuth states.`);
    }
  }

  static generateStateParameter(): string {
    return randomBytes(32).toString("hex");
  }
}
