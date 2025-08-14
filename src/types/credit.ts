import type { CreditLedgerEntity } from "@/lib/db/pg/schema.pg";

export type CreditRepository = {
  getBalance(workspaceId: string): Promise<number>;
  addCredits(
    workspaceId: string,
    amount: number,
    description: string,
    userId?: string,
  ): Promise<number>;
  consumeCredits(
    workspaceId: string,
    userId: string,
    amount: number,
    description: string,
  ): Promise<number>;
  getLedger(
    workspaceId: string,
    limit?: number,
    offset?: number,
  ): Promise<CreditLedgerEntity[]>;
  getSubscriptionAndUserByStripeIds(
    stripeCustomerId: string,
    stripeSubscriptionId: string,
  ): Promise<{ referenceId: string; userId: string } | null>;
};
