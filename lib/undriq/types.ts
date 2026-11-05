import type { Plan } from "../types";
import type { AssetClass } from "./assets";
import type { Analysis, DealFacts, Teaser } from "./engine";
import type { OfferStatus, OfferTerms } from "./offers";
import type { PropertyRecord } from "../integrations/rentcast";

export type SpaceKind = "personal" | "team";

export interface Space {
  orgId: string;
  name: string;
  kind: SpaceKind;
  role: "owner" | "member";
  ownerUserId: string | null;
  /** Effective plan of the space (a team runs on the better of its own and its owner's plan). */
  plan: Plan;
}

export interface SpaceMember {
  userId: string | null;
  name: string;
  email: string;
  role: "owner" | "member";
  pending: boolean;
}

export const ANALYSIS_STAGES = ["analyzed", "offer_sent", "negotiating", "under_contract", "closed", "dead"] as const;
export type AnalysisStage = (typeof ANALYSIS_STAGES)[number];
export const ANALYSIS_STAGE_LABEL: Record<AnalysisStage, string> = {
  analyzed: "Analyzed",
  offer_sent: "Offer sent",
  negotiating: "Negotiating",
  under_contract: "Under contract",
  closed: "Closed",
  dead: "Dead",
};

export interface Memo {
  headline: string;
  thesis: string[];
  risks: string[];
  nextSteps: string[];
  killers: string[];
  mustBeTrue: string[];
  offerScript: string;
}

export interface Motivation {
  score: number;
  signals: string[];
  leverage: string;
}

export interface SavedOffer {
  id: string;
  at: string;
  status: OfferStatus;
  terms: OfferTerms;
}

/** Full result for paid spaces; Scout gets the teaser only (stripped on the server). */
/** `sample: true` marks Scout's free first analysis, which stays fully unlocked. */
export type StoredResult = { full: true; analysis: Analysis; sample?: boolean } | { full: false; teaser: Teaser };

export interface AnalysisRow {
  id: string;
  org_id: string;
  created_by: string | null;
  name: string;
  asset: AssetClass;
  property_type: string;
  city: string | null;
  state: string | null;
  listing_url: string | null;
  stage: AnalysisStage;
  score: number;
  facts: DealFacts;
  result: StoredResult;
  memo: Memo | null;
  motivation: Motivation | null;
  offers: SavedOffer[];
  notes: string;
  /** Property data (RentCast) the analysis used, if any. */
  records?: PropertyRecord | null;
  created_at: string;
  updated_at: string;
}

export type NewAnalysis = Omit<AnalysisRow, "id" | "org_id" | "created_by" | "created_at" | "updated_at">;
