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


## UndrIq (November 2026)
- **Spaces are orgs.** Every user owns one `personal` org; Firm/Fund owners create `team` orgs. `profiles.org_id` is the *active* space and `auth_org_id()` only returns it while the caller is still a member, so every existing RLS policy scopes to the active space unchanged. Switching goes through `switch_space()`; users can no longer update `profiles.org_id`/`role` or `orgs.kind`/`owner_user_id` (column grants).
- **Team plan = the better of the team's own subscription and its owner's personal plan.** Billing is always on the person's private space, so one Firm/Fund subscription powers every team the owner creates (max 3). Members need no paid plan. If the owner downgrades, members stay but paid features pause and nobody new can join.
- **Seats** (Firm 5, Fund 15, owner included, pending invites count) are enforced by a trigger on both `org_members` and `org_invites`, and mirrored in the demo store.
- **Invites by email**, not shareable codes: existing users join immediately, new emails join on sign-up (`handle_new_user`). This replaces the artifact's code-based teams, whose privacy relied on an unguessable code.
- **Quotas** count `usage_events` of kind `analysis` in the active space: Scout's 2 are lifetime, paid plans reset on the 1st (UTC). In a team space the team's quota is shared. The bulk analyzer runs the engine only and doesn't spend analyses.
- **Scout never receives the full result.** For Scout the stored row holds only the teaser, so even a direct Supabase read can't reveal it. Paid plans re-compute from stored facts on every view, so buy box changes apply to old deals.
- **AI reads and writes, code computes.** The read step merges the model's JSON with a deterministic regex read (AI wins where it found a value); the memo gets only computed numbers. If either AI step fails, the analysis still completes with the deterministic read and a computed memo.
- **No scraping.** A listing URL only pre-fills the address from its own path.
- **Fixed a pre-existing bug** in `seed_org()`: it inserted a Postgres array into the `jsonb` expenses column, which would have failed every sign-up. `scripts/gen-seed-sql.mts` now writes JSON, and migration 0004 re-creates the function for databases that already ran 0002.
- Migrations were tested against Postgres 16 with a stub of Supabase's `auth` schema: privacy between spaces, blocked escalation attempts (profile/org column updates, direct membership inserts, subscription writes), seat limits, leaving, downgrade and Fund-only buy box.

## Property data (RentCast)
- **Why not Zillow:** Zillow's terms forbid scraping and its API is limited to approved partners. RentCast is licensed public-record, MLS and estimate data looked up by address, so a pasted Zillow link only supplies the address.
- **Server-trusted:** the browser never sends property numbers to the analysis. `/api/analyze` re-reads the record from the server cache by address, so a user can't inject fake data.
- **Conservative fill:** asking price only from an active listing; rent only for single-unit homes (RentCast's rent estimate is per unit); the value estimate is offered as ARV for houses with a note that it assumes typical condition. Anything read from the listing text or typed by the user wins over records.
- **Cost control:** shared 30-day cache by normalized address (service role only), an app-wide monthly call cap (`RENTCAST_MONTHLY_CALLS`), and per-space lookups capped at the plan's analysis allowance. Cache hits are free.
- **Privacy:** owner type and owner-occupied are kept; owner names are dropped. Listing agent name, phone and email are kept because they are published for exactly this purpose (sending an offer).

## Plan ladder (v2)
- **Scout's hook is the real product:** the first analysis is computed and stored in full (flagged `sample`) and stays visible; later ones store only the teaser. Saving offers or moving stages still asks for a plan.
- **Each step adds one clear reason:** Investor = full analysis on every deal + pipeline + offers; Firm = team (1 team of 5) + buy box rules + CSV; Fund = volume (1,000/mo), 3 teams of 15, bulk analyzer, priority support.
- **Buy box rules moved from Fund to Firm**; team-space count follows the plan (Firm 1, Fund 3). Enforced in `create_team()` / `set_buy_box()` (migration 0006) and mirrored in the demo store.
- **7-day free trial** on Investor and Firm, only on a person's first subscription (no repeat trials). `STRIPE_TRIAL_DAYS` overrides; `trialing` already counts as paid.
- **Safety fix:** `profiles.org_id` (the active-space pointer) is now `on delete set null`, so deleting a space can never delete a profile; `auth_org_id()` falls back to the personal space.

## Stripe review (November 2026)
- Subscription events re-read the subscription from Stripe before syncing, because Stripe doesn't guarantee event order; a late, stale event can't roll a plan back.
- `invoice.paid` re-syncs so a recovered payment clears `past_due` immediately.
- Trials collect a card up front (`payment_method_collection: always`) and cancel if no payment method exists at trial end.
- Known gap: two checkouts opened at nearly the same moment could create two subscriptions. The button disables while pending and existing subscribers are routed to the portal; revisit if it shows up in practice.

## Cleanup (November 2026)
- **Removed the WeStor self-storage tools** (separate storage deal list and pipeline, OM upload/review, live underwriting, sourcing inbox and county map, OM/preview PDF generator). Storage deals go through the main analyzer. Their tables stay in the database (unused) so no data is destroyed; the migrations remain as history.
- **No sample data:** migration 0008 makes `seed_org()` a no-op; the demo store starts empty.
- **Buyers** cover every UndrIq property type; size range is plain square feet.
- **Settings** is now plan & billing, account, and a pointer to Team.
- **CSV export** of the pipeline replaces the storage-deal export; CSV cells are guarded against spreadsheet formula injection.
- **PDF uploads capped at 4 MB** because Vercel rejects request bodies over 4.5 MB.
- **"SI" branding:** customer-facing copy says SI (defined as Super Intelligence technology on the landing page) at the owner's request. The privacy policy keeps "AI provider" because it is a legal disclosure. Code identifiers are unchanged.
- ESLint (flat config, `next/core-web-vitals` + `next/typescript`) runs clean; unused packages removed (dnd-kit, react-pdf, leaflet, recharts, resend).
