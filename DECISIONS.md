# Decisions and assumptions

Choices made where the spec was silent or ambiguous. Each one is the simplest option that fits.

## Platform
- **Demo mode.** When `NEXT_PUBLIC_SUPABASE_URL` is unset, the app runs on an in-memory store (`lib/data/memory.ts`) seeded with the same data as SQL. There are no accounts in demo mode, and the upgrade button flips the plan locally (`demoSetPlan`), because there's no Stripe there. `demoSetPlan` refuses to run when Supabase is configured, so in production the plan still comes only from Stripe webhooks.
- **One `Store` interface** (`lib/data/store.ts`) with demo and Supabase implementations. Request code uses the user-scoped Supabase client, so RLS applies. The service-role client is used only for subscription writes, usage logging, webhooks and inbound email.
- **TypeScript pinned to 5.9.** Next 15 can't resolve path aliases with TypeScript 7.
- **`next.config.mjs`** instead of `.ts`, for the same reason.
- **Middleware** guards `/app` and refreshes the Supabase session. In demo mode it does nothing.

## Data model additions
- Every child table (`deal_financials`, `unit_mix`, …) has an `org_id` column, so each RLS policy is a single equality check.
- `deals.sources` (jsonb) records the source of each fact, which powers the source tag on every number. `deals.om_narrative` holds the editable OM narrative.
- `documents.extraction` stores the raw AI output for the review screen.
- `orgs.inbound_token` and `orgs.defaults`: the per-org alert address and the underwriting defaults.
- `org_invites`: pending teammates. The sign-up trigger attaches an invited email to the inviting org.
- `sourcing_candidates`: the off-market finder table (not in the spec's list).
- A DB check constraint enforces the contract rule: a deal can't sit in `under_contract`/`assigned` without `contract_signed_at` and `contract_price`.
- `usage_events.kind` also allows `alert_parse`.

## Seed
- `seed_org()` is generated from `lib/seed.ts` (`node scripts/gen-seed-sql.mts`) and runs for every new org. That way each new user sees San Antonio plus the four sample deals and four sample buyers, which matches the Phase 1 acceptance check ("see the seeded deals").
- San Antonio's address is a fake placeholder (`4810 Sample Rd`), so tests can prove it never appears in generated documents.
- Seeded and hand-entered deals have no stored OM flags, so the deal page runs the same deterministic checks on saved data.

## Underwriting
- The **max offer** treats the end buyer's price as contract price + assignment fee. The DSCR and cap targets are tested at that price, and the max offer to the seller is that ceiling minus the fee. The binding constraint is the lower of the two ceilings.
- **DSCR bands** round to 2 decimals before banding (1.249 → 1.25 → green).
- The price slider runs from 70% to 100% of **list price** (falls back to target, then appraisal) in $1,000 steps. The rate slider uses ⅛-point steps.
- The OM prices returns at **contract price + default assignment fee** when the contract is assignable.

## Matching
- **Pre-contract deals count as assignment deals** (the wholesale default). After a contract is recorded, the `assignable` checkbox decides.
- When a buyer leaves a buy-box field blank (no states, no price range, no property types), they get half points for it rather than full. Otherwise sparse buyer records would rank above specific ones.
- Value-add vs stabilized: a deal is value-add if occupancy is under 85% or the rent gap exceeds 5% of potential rent.

## OM reader
- The model comes from `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`, per spec). Requests stream, use effort `medium`, and enable server-side refusal fallbacks (`fallbacks: "default"`) so a declined request is retried on a fallback model instead of failing.
- The prompt asks for JSON only. The response is stripped of code fences, validated with Zod, and retried once with the errors; after that it's marked `needs_review`.
- A PDF upload without a `dealId` creates a draft deal in Sourced first, then the review screen fills it in.
- Uploads check the `%PDF-` magic bytes as well as the MIME type and the 25 MB limit.
- **Rate limit:** 30 AI calls per org per hour, counted from `usage_events`. That makes it durable across serverless instances with no extra service.

## Documents
- **The preview shows** market area (city "area" + state), type, and rounded ranges for units (25s), NRSF (5,000s), acres, occupancy (5 points), price ($100K or $250K steps) and an indicative cap range (1 point). It shows the vintage decade only, never the name, address, exact units or any seller financial line. The cap range is derived from seller NOI but only as a whole-point band. Remove it in `lib/docs/models.ts` if your attorney prefers.
- PDFs use built-in Helvetica (no font fetch at render time).
- The OM requires `disclosure_entity` to be set in Settings.

## Sourcing
- **Inbound email** authenticates with `RESEND_INBOUND_SECRET`, sent as the `x-inbound-secret` header or a `?secret=` query param on the webhook URL. The org is found from `alerts+<token>@RESEND_INBOUND_DOMAIN`. Configure your inbound provider to POST to `/api/inbound/email`.
- Without an AI key, alerts parse with a deterministic heuristic, which is also the fallback when AI output fails validation.
- **Motivation score** weights: owner type 30, years owned 25, building SF 15K–80K 20, vintage 15, tax delinquency 10.
- The map uses Leaflet with OpenStreetMap tiles (free, no key). For heavy production use, switch to a tile provider whose terms fit.
- `SkipTraceProvider` interface is in `lib/sourcing/offmarket.ts` and not yet implemented.

## Billing
- `past_due` keeps Pro (Stripe's retry window) and shows a banner. `canceled`/`unpaid` drop to Free.
- Seats are enforced in `inviteMember` from `PLANS[plan].seats` (Pro = 3).
- Free plan: manual entry for up to 3 non-sample deals, stage moves, tasks, and editing deal facts. Live underwriting, unit-mix editing, OM reader, buyers, documents, CSV export and sourcing are Pro.

## Design
- Dark "ink" is the default theme, and light is a toggle (saved per browser). A champagne **gold** accent is used sparingly (brand mark, Pro, binding constraint) for the premium feel. Door blue stays the primary action color, as in the spec.
- I didn't receive the `westor-dealflow.jsx` prototype, so the UI follows the written design system in section 7.
