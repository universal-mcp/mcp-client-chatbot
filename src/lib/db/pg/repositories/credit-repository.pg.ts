import { pgDb as db } from "../db.pg";
import { CreditLedgerSchema, type CreditLedgerEntity } from "../schema.pg";
import { desc, eq, and } from "drizzle-orm";
import type { CreditRepository } from "@/types/credit";
import { subscription, user } from "../auth.pg";

export const pgCreditRepository: CreditRepository = {
  async getBalance(workspaceId: string): Promise<number> {
    const [latestEntry] = await db
      .select()
      .from(CreditLedgerSchema)
      .where(eq(CreditLedgerSchema.workspaceId, workspaceId))
      .orderBy(desc(CreditLedgerSchema.createdAt))
      .limit(1);
    return latestEntry?.balance ?? 0;
  },

  async addCredits(
    workspaceId: string,
    amount: number,
    description: string,
    userId?: string,
  ): Promise<number> {
    const currentBalance = await this.getBalance(workspaceId);
    const newBalance = currentBalance + amount;

    await db.insert(CreditLedgerSchema).values({
      workspaceId,
      userId,
      change: amount,
      balance: newBalance,
      description,
    });

    return newBalance;
  },

  async consumeCredits(
    workspaceId: string,
    userId: string,
    amount: number,
    description: string,
  ): Promise<number> {
    const currentBalance = await this.getBalance(workspaceId);
    if (currentBalance < amount) {
      throw new Error("Insufficient credits");
    }
    const newBalance = currentBalance - amount;

    await db.insert(CreditLedgerSchema).values({
      workspaceId,
      userId,
      change: -amount,
      balance: newBalance,
      description,
    });

    return newBalance;
  },

  async getLedger(
    workspaceId: string,
    limit = 50,
    offset = 0,
  ): Promise<CreditLedgerEntity[]> {
    return db
      .select()
      .from(CreditLedgerSchema)
      .where(eq(CreditLedgerSchema.workspaceId, workspaceId))
      .orderBy(desc(CreditLedgerSchema.createdAt))
      .limit(limit)
      .offset(offset);
  },

  async getSubscriptionAndUserByStripeIds(
    stripeCustomerId: string,
    stripeSubscriptionId: string,
  ): Promise<{ referenceId: string; userId: string } | null> {
    const result = await db
      .select({
        referenceId: subscription.referenceId,
        userId: user.id,
      })
      .from(subscription)
      .innerJoin(user, eq(subscription.stripeCustomerId, user.stripeCustomerId))
      .where(
        and(
          eq(subscription.stripeCustomerId, stripeCustomerId),
          eq(subscription.stripeSubscriptionId, stripeSubscriptionId),
        ),
      )
      .limit(1);

    return result[0] || null;
  },
};
