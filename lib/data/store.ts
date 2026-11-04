import type {
  Activity,
  Buyer,
  Deal,
  DealBundle,
  DealBuyerMatch,
  DealDocument,
  DealFinancial,
  DealFlag,
  DealSummary,
  MatchStatus,
  Org,
  Profile,
  Subscription,
  Task,
  UnitMix,
} from "../types";

export interface SourcingCandidate {
  id: string;
  org_id: string;
  county: string;
  parcel_id: string;
  owner_name: string;
  owner_type: "individual" | "small_llc" | "institutional";
  situs_city: string;
  situs_state: string;
  building_sf: number | null;
  year_built: number | null;
  years_owned: number | null;
  tax_delinquent: boolean;
  lat: number | null;
  lng: number | null;
  score: number;
  reasons: string[];
  added_deal_id: string | null;
  created_at: string;
}

export type NewDeal = Omit<Deal, "id" | "org_id" | "created_at" | "updated_at">;

export interface Store {
  getOrg(orgId: string): Promise<Org | null>;
  updateOrg(orgId: string, patch: Partial<Omit<Org, "id">>): Promise<Org>;
  findOrgByInboundToken(token: string): Promise<Org | null>;

  listMembers(orgId: string): Promise<Profile[]>;
  addMember(orgId: string, email: string, fullName: string): Promise<Profile>;

  getSubscription(orgId: string): Promise<Subscription>;
  upsertSubscription(sub: Subscription): Promise<void>;
  findOrgIdByStripeCustomer(customerId: string): Promise<string | null>;

  listDeals(orgId: string): Promise<DealSummary[]>;
  countUserDeals(orgId: string): Promise<number>;
  getDealBundle(orgId: string, dealId: string): Promise<DealBundle | null>;
  createDeal(orgId: string, input: NewDeal): Promise<Deal>;
  updateDeal(orgId: string, dealId: string, patch: Partial<NewDeal>): Promise<Deal>;
  setNarrative(orgId: string, dealId: string, narrative: string): Promise<void>;

  replaceFinancials(orgId: string, dealId: string, rows: Omit<DealFinancial, "id" | "deal_id">[]): Promise<void>;
  replaceUnitMix(orgId: string, dealId: string, rows: Omit<UnitMix, "id" | "deal_id">[]): Promise<void>;
  replaceFlags(orgId: string, dealId: string, rows: Omit<DealFlag, "id" | "deal_id">[]): Promise<void>;

  addDocument(orgId: string, doc: Omit<DealDocument, "id" | "created_at">): Promise<DealDocument>;
  updateDocument(orgId: string, docId: string, patch: Partial<DealDocument>): Promise<void>;
  getDocument(orgId: string, docId: string): Promise<DealDocument | null>;

  listBuyers(orgId: string): Promise<Buyer[]>;
  upsertBuyer(orgId: string, buyer: Omit<Buyer, "org_id" | "created_at" | "id"> & { id?: string }): Promise<Buyer>;
  deleteBuyer(orgId: string, buyerId: string): Promise<void>;

  listMatchStatuses(orgId: string, dealId: string): Promise<DealBuyerMatch[]>;
  setMatchStatus(orgId: string, dealId: string, buyerId: string, status: MatchStatus, score: number, reasons: string[]): Promise<void>;

  addTask(orgId: string, task: Omit<Task, "id" | "created_at" | "done">): Promise<Task>;
  updateTask(orgId: string, taskId: string, patch: Partial<Task>): Promise<void>;
  deleteTask(orgId: string, taskId: string): Promise<void>;

  logActivity(entry: Omit<Activity, "id" | "created_at">): Promise<void>;
  logUsage(orgId: string, kind: "om_parse" | "doc_generate" | "alert_parse", tokensIn: number, tokensOut: number): Promise<void>;
  countUsageSince(orgId: string, sinceIso: string): Promise<number>;

  listCandidates(orgId: string): Promise<SourcingCandidate[]>;
  replaceCandidates(orgId: string, county: string, rows: Omit<SourcingCandidate, "id" | "org_id" | "created_at">[]): Promise<void>;
  markCandidateAdded(orgId: string, candidateId: string, dealId: string): Promise<void>;

  putFile(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  getFile(path: string): Promise<Uint8Array | null>;
}
