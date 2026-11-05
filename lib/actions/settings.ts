"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { planFor } from "../billing/plans";
import { HttpError, run } from "../server/run";
import type { ActionResult } from "./result";

const orgSchema = z.object({
  name: z.string().trim().min(1, "Enter your firm name"),
  brand_name: z.string().trim(),
  brand_tagline: z.string().trim(),
  contact_name: z.string().trim(),
  contact_phone: z.string().trim(),
  contact_email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  disclosure_entity: z.string().trim(),
  logo_url: z.string().trim().url("Logo must be a full https:// URL").or(z.literal("")).transform((v) => v || null),
});

export async function updateOrgSettings(input: z.input<typeof orgSchema>): Promise<ActionResult> {
  return run(async ({ store, orgId, user }) => {
    if (user.role !== "owner") throw new HttpError(403, "Only the owner can change firm settings.");
    await store.updateOrg(orgId, orgSchema.parse(input));
    revalidatePath("/app", "layout");
    return null;
  });
}

const defaultsSchema = z.object({
  down_pct: z.number().min(0.1).max(1),
  rate: z.number().min(0.01).max(0.2),
  years: z.number().refine((y) => y === 20 || y === 25 || y === 30, "Choose 20, 25 or 30 years"),
  target_dscr: z.number().min(1).max(3),
  target_cap: z.number().min(0.03).max(0.2),
  assignment_fee: z.number().min(0),
});

export async function updateDefaults(input: z.input<typeof defaultsSchema>): Promise<ActionResult> {
  return run(async ({ store, orgId }) => {
    await store.updateOrg(orgId, { defaults: defaultsSchema.parse(input) });
    revalidatePath("/app", "layout");
    return null;
  });
}
