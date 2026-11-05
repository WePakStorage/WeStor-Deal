import type { AnalysisRow, NewAnalysis, Space, SpaceMember } from "../undriq/types";

export type UsageKind = "analysis" | "om_parse" | "doc_generate" | "alert_parse" | "property_lookup";
export type InviteResult = "added" | "invited" | "already";

/**
 * Spaces (personal + team), AI analyses and quota usage.
 * Every permission rule lives in the database functions for Supabase (see the 0003 migration)
 * and is mirrored by the in-memory demo store; app code never decides membership by itself.
 */
export interface UqStore {
  listSpaces(userId: string): Promise<Space[]>;
  activeOrgId(userId: string): Promise<string | null>;
  switchSpace(userId: string, orgId: string): Promise<void>;
  createTeam(userId: string, name: string): Promise<string>;
  inviteToTeam(userId: string, orgId: string, email: string): Promise<InviteResult>;
  removeFromTeam(userId: string, orgId: string, targetUserId: string): Promise<void>;
  revokeInvite(userId: string, orgId: string, email: string): Promise<void>;
  deleteTeam(userId: string, orgId: string): Promise<void>;
  renameTeam(userId: string, orgId: string, name: string): Promise<void>;
  listSpaceMembers(orgId: string): Promise<SpaceMember[]>;

  getBuyBox(orgId: string): Promise<unknown>;
  setBuyBox(orgId: string, rules: unknown): Promise<void>;

  listAnalyses(orgId: string): Promise<AnalysisRow[]>;
  getAnalysis(orgId: string, id: string): Promise<AnalysisRow | null>;
  createAnalysis(orgId: string, userId: string, row: NewAnalysis): Promise<AnalysisRow>;
  updateAnalysis(orgId: string, id: string, patch: Partial<NewAnalysis>): Promise<AnalysisRow>;
  deleteAnalysis(orgId: string, id: string): Promise<void>;

  recordUsage(orgId: string, userId: string, kind: UsageKind, tokensIn: number, tokensOut: number): Promise<void>;
  countUsage(orgId: string, kind: UsageKind, sinceIso: string): Promise<number>;
}

export class SpaceError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
