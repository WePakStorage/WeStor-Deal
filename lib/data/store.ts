import type { Buyer, Org, Subscription } from "../types";

export type BuyerInputRow = Omit<Buyer, "org_id" | "created_at" | "id"> & { id?: string };

/**
 * Spaces, subscriptions and buyer lists. Analyses, teams and usage live in UqStore (uq-store.ts).
 * Every method takes the space (org) id explicitly, so the service-role path is safe too.
 */
export interface Store {
  getOrg(orgId: string): Promise<Org | null>;

  getSubscription(orgId: string): Promise<Subscription>;
  upsertSubscription(sub: Subscription): Promise<void>;
  findOrgIdByStripeCustomer(customerId: string): Promise<string | null>;

  listBuyers(orgId: string): Promise<Buyer[]>;
  upsertBuyer(orgId: string, buyer: BuyerInputRow): Promise<Buyer>;
  deleteBuyer(orgId: string, buyerId: string): Promise<void>;
}

export const freeSubscription = (orgId: string): Subscription => ({
  org_id: orgId,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  plan: "free",
  status: "none",
  current_period_end: null,
});
