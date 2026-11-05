# UndrIq

AI deal analyzer for real estate investors and wholesalers. Paste a listing or upload an OM and get a deal score, a five-exit strategy matrix, an offer ladder, a stress test, an analyst memo and a ready-to-send offer. Residential, multifamily, self storage, industrial and retail/office. The original self-storage tools (OM reader, live underwriting, sourcing) still live under **Storage OM tools**.

**Spaces.** Every account has a private space: its own pipeline and buyer list that nobody else can see. Firm ($149, 5 seats) and Fund ($399, 15 seats) owners can create shared team spaces and add people by email. Membership, seat limits and plan checks are enforced in Postgres (see `supabase/migrations/20261105000003_undriq_spaces.sql`), not just in the app.

**Plans.** Scout (free, 2 analyses with the score and best exit), Investor $49 (40/month), Firm $149 (200/month + teams + CSV), Fund $399 (1,000/month fair use + bulk analyzer + buy box rules). The server strips the full analysis for Scout; the blur in the UI is cosmetic.

Next.js (App Router) · TypeScript strict · Tailwind v4 · Supabase · Stripe · Anthropic Claude · Resend · PostHog · Vitest · Playwright.

## Quick start (demo mode, no accounts needed)

```bash
npm install
npm run dev        # http://localhost:3000 → "Enter the demo workspace"
```

With no Supabase keys, the app runs on an in-memory store. Without an Anthropic key, analyses use the deterministic reader (it pulls labelled numbers like price, rent, NOI, ARV and repairs from the pasted text). Pick any plan in the upgrade dialog to simulate Stripe. Data resets when the server restarts.

## Going live

1. **Supabase**: create a project, then run the migrations in `supabase/migrations` (`supabase db push`, or paste them into the SQL editor in order).
   - Auth → Providers: enable Email (magic link) and Google.
   - Auth → URL configuration: add `https://YOUR_DOMAIN/auth/callback`.
   - The migration creates the private `deal-files` storage bucket.
2. **Stripe** (test mode first): create three monthly prices (Investor $49, Firm $149, Fund $399) and put their IDs in `STRIPE_PRICE_INVESTOR`, `STRIPE_PRICE_FIRM` and `STRIPE_PRICE_FUND`. Subscriptions attach to the buyer's private space; their Firm or Fund plan powers every team they own. Add a webhook to `https://YOUR_DOMAIN/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` and `invoice.payment_failed`. Turn on the customer portal (allow cancel, card update and switching between the three prices).
3. **RentCast** (property data): set `RENTCAST_API_KEY` and, to match your RentCast plan, `RENTCAST_MONTHLY_CALLS` (default 50 = the free tier). Run migration `0005`. Users paste a Zillow/Redfin/Realtor.com link or type an address and click **Pull property data**; UndrIq looks the ADDRESS up in RentCast (it never touches the listing site). Each new address costs up to 4 API calls and is cached for 30 days; lookups count against the plan's analysis allowance.
4. **Anthropic**: set `ANTHROPIC_API_KEY`. `ANTHROPIC_MODEL` defaults to `claude-sonnet-5-5`.
5. **Resend inbound**: route `alerts+*@YOUR_INBOUND_DOMAIN` to `POST https://YOUR_DOMAIN/api/inbound/email` with header `x-inbound-secret: $RESEND_INBOUND_SECRET`. Set `RESEND_INBOUND_DOMAIN`.
6. **PostHog**: set `NEXT_PUBLIC_POSTHOG_KEY` (optional).
7. **Vercel**: import the GitHub repo, add every variable from `.env.example`, and deploy.

Copy `.env.example` to `.env.local` for local development with real services.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build && npm start` | Production build |
| `npm test` | Vitest unit tests (underwriting, flags, matching, docs, pipeline, sourcing, CSV import) |
| `npm run e2e` | Playwright happy path (builds and starts the app in demo mode) |
| `npm run typecheck` | `tsc --noEmit` |
| `node scripts/gen-seed-sql.mts` | Regenerate the `seed_org()` migration from `lib/seed.ts` |

## Where things live

- `lib/underwriting.ts`: amortization and the self-storage underwriting math
- `lib/undriq/engine.ts`: UndrIq engine (income, exit matrix, offer ladder, stress test, red flags, score, buy box rules). Uses the amortization from `lib/underwriting.ts`
- `lib/undriq/service.ts`: the analyze pipeline (quota → AI read → engine → AI memo → save) and plan stripping
- `lib/undriq/offers.ts`: LOI, email and text templates (no AI)
- `lib/undriq/linkparse.ts`: reads the address from a listing URL (never fetches it)
- `lib/data/uq-*.ts`: spaces, analyses and usage for Supabase (RPC + RLS) and demo mode
- `lib/actions/undriq.ts`: server actions for spaces, pipeline, offers, buy box and bulk
- `lib/om/`: OM extraction schema and prompt, the deterministic red-flag checks, review mapping
- `lib/matching.ts`: buyer scoring
- `lib/pipeline.ts`: the contract gate and the OM compliance gate
- `lib/docs/`: preview and OM models (pure, tested) and PDF rendering
- `lib/server/gate.ts`: `requireFeature(ctx, feature)` against the active space's plan, and the AI rate limit
- `lib/billing/plans.ts`: plan config. Add tiers here.
- `supabase/migrations/`: schema, RLS and the sign-up trigger

## Before charging real customers

- Switch Stripe to live mode (new keys, live price ID, live webhook secret).
- Have an attorney review the Terms, Privacy Policy, the pre-contract preview wording and the equitable-interest disclosure (`lib/docs/models.ts`).
- Set up a custom domain and a verified email sending domain (Supabase auth emails + Resend).
- Run the RLS check: sign in as two users and confirm neither sees the other's private deals, then add one to the other's team and confirm only team deals are shared.
