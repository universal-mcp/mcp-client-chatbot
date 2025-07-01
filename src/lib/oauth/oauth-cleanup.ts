import { OAuthStateManager } from "./oauth-state-manager";
import logger from "@/lib/logger";

// Cleanup interval - run every 30 minutes
const CLEANUP_INTERVAL = 30 * 60 * 1000;

class OAuthCleanupService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  /**
   * Start the cleanup service
   */
  start(): void {
    if (this.isRunning) {
      logger.warn("OAuth cleanup service is already running");
      return;
    }

    this.isRunning = true;

    // Run cleanup immediately
    this.runCleanup();

    // Schedule periodic cleanup
    this.intervalId = setInterval(() => {
      this.runCleanup();
    }, CLEANUP_INTERVAL);

    logger.info("OAuth cleanup service started");
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info("OAuth cleanup service stopped");
  }

  /**
   * Run cleanup once
   */
  private async runCleanup(): Promise<void> {
    try {
      await OAuthStateManager.cleanupExpiredStates();
    } catch (error) {
      logger.error("OAuth cleanup failed:", error);
    }
  }

  /**
   * Force cleanup now (useful for testing or manual cleanup)
   */
  async forceCleanup(): Promise<void> {
    await this.runCleanup();
  }

  /**
   * Check if service is running
   */
  get running(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const oauthCleanupService = new OAuthCleanupService();

// Auto-start in production environments
if (process.env.NODE_ENV === "production") {
  // Start with a delay to allow database to be ready
  setTimeout(() => {
    oauthCleanupService.start();
  }, 5000);
}

// Graceful shutdown
process.on("SIGTERM", () => {
  oauthCleanupService.stop();
});

process.on("SIGINT", () => {
  oauthCleanupService.stop();
});
