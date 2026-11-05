# UndrIq

AI deal analyzer for real estate investors and wholesalers. Paste a listing or upload an OM and get a deal score, a five-exit strategy matrix, an offer ladder, a stress test, an analyst memo and a ready-to-send offer. Residential, multifamily, self storage, industrial and retail/office.

**Spaces.** Every account has a private space: its own pipeline and buyer list that nobody else can see. Firm ($149, 5 seats) and Fund ($399, 15 seats) owners can create shared team spaces and add people by email. Membership, seat limits and plan checks are enforced in Postgres (see `supabase/migrations/20261105000003_undriq_spaces.sql`), not just in the app.

**Plans.** Scout (free: 3 analyses, the first fully unlocked, then score and best exit), Investor $49 (50/month, full analysis, pipeline, offers; 7-day trial), Firm $149 (250/month, 1 team of 5, buy box rules, CSV; 7-day trial), Fund $399 (1,000/month fair use, 3 teams of 15, bulk analyzer, priority support). The server strips the full analysis for Scout after the first; the blur in the UI is cosmetic.

Next.js (App Router) · TypeScript strict · Tailwind v4 · Supabase · Stripe · Anthropic Claude (marketed as SI) · RentCast · PostHog · Vitest · Playwright.

## Quick start (demo mode, no accounts needed)

```bash
npm install
npm run dev        # http://localhost:3000 → "Enter the demo workspace"
```

With no Supabase keys, the app runs on an in-memory store that starts empty. Without an Anthropic key, analyses use the deterministic reader (it pulls labelled numbers like price, rent, NOI, ARV and repairs from the pasted text). Pick any plan in the upgrade dialog to simulate Stripe. Data resets when the server restarts.

## Going live

1. **Supabase** (database and sign-in):
   - Create a project. In **SQL Editor**, run every file in `supabase/migrations` in order (0001 → 0008). 0007 repairs anyone who signed up before the setup ran; 0008 stops sample data in new accounts.
   - Not sure what has run? This shows which steps exist (true = done):
     `select to_regclass('public.orgs') is not null as m0001, exists(select 1 from pg_proc where proname='seed_org') as m0002, to_regclass('public.analyses') is not null as m0003, to_regclass('public.property_lookups') is not null as m0005, exists(select 1 from pg_proc where proname='ensure_account') as m0007;`
   - **Authentication → Sign In / Providers → Email**: on, with **Confirm email** on. Set the minimum password length to 8.
   - **Authentication → URL Configuration**: Site URL = `https://YOUR_DOMAIN`; Redirect URLs = `https://YOUR_DOMAIN/auth/callback` (add `http://localhost:3000/auth/callback` for local dev).
   - **Authentication → Emails → SMTP**: add your own sender (e.g. Resend SMTP). Supabase's built-in sender only sends a few emails an hour, which isn't enough for sign-up confirmations and password resets in production.
   - Optional: Google provider for "Continue with Google".
   - The migrations create the private `deal-files` storage bucket and, on every sign-up, a private space for the new user.
2. **Stripe** (test mode first): create three monthly prices (Investor $49, Firm $149, Fund $399) and put their IDs in `STRIPE_PRICE_INVESTOR`, `STRIPE_PRICE_FIRM` and `STRIPE_PRICE_FUND`. Subscriptions attach to the buyer's private space; their Firm or Fund plan powers every team they own. Add a webhook to `https://YOUR_DOMAIN/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid` and `invoice.payment_failed`. Turn on the customer portal (allow cancel, card update and switching between the three prices).
   - `STRIPE_SECRET_KEY` can be the standard secret key (`sk_live_…`) or a restricted key (`rk_live_…`). A restricted key needs: **Checkout Sessions: Write**, **Customer portal: Write**, **Customers: Write**, **Subscriptions: Read**, **Prices: Read**, **Products: Read**, **Invoices: Read**.
3. **RentCast** (property data): set `RENTCAST_API_KEY` and, to match your RentCast plan, `RENTCAST_MONTHLY_CALLS` (default 50 = the free tier). Run migration `0005`. Users paste a Zillow/Redfin/Realtor.com link or type an address and click **Pull property data**; UndrIq looks the ADDRESS up in RentCast (it never touches the listing site). Each new address costs up to 4 API calls and is cached for 30 days; lookups count against the plan's analysis allowance.
4. **Anthropic**: set `ANTHROPIC_API_KEY`. `ANTHROPIC_MODEL` defaults to `claude-sonnet-5-5`.
5. **PostHog**: set `NEXT_PUBLIC_POSTHOG_KEY` (optional).
6. **Vercel**: import the GitHub repo, add every variable from `.env.example`, and deploy.

Copy `.env.example` to `.env.local` for local development with real services.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build && npm start` | Production build |
| `npm test` | Vitest unit tests (engine, offers, link parsing, extraction guards, plans, RentCast, auth, CSV import) |
| `npm run lint` | ESLint (Next.js core web vitals + TypeScript) |
| `npm run e2e` | Playwright happy path: analyze, upgrade, offer, pipeline (demo mode) |
| `npm run typecheck` | `tsc --noEmit` |

## Where things live

- `lib/underwriting.ts`: amortization and core underwriting formulas (tested)
- `lib/undriq/engine.ts`: UndrIq engine (income, exit matrix, offer ladder, stress test, red flags, score, buy box rules). Uses the amortization from `lib/underwriting.ts`
- `lib/undriq/service.ts`: the analyze pipeline (quota → AI read → engine → AI memo → save) and plan stripping
- `lib/undriq/offers.ts`: LOI, email and text templates (no AI)
- `lib/undriq/linkparse.ts`: reads the address from a listing URL (never fetches it)
- `lib/data/uq-*.ts`: spaces, analyses and usage for Supabase (RPC + RLS) and demo mode
- `lib/actions/undriq.ts`: server actions for spaces, pipeline, offers, buy box and bulk
- `lib/server/gate.ts`: `requireFeature(ctx, feature)` against the active space's plan, and the AI rate limit
- `lib/billing/plans.ts`: plan config. Add tiers here.
- `supabase/migrations/`: schema, RLS and the sign-up trigger

## Before charging real customers

- Switch Stripe to live mode (new keys, live price ID, live webhook secret).
- Have an attorney review the Terms, Privacy Policy, the offer letter templates (`lib/undriq/offers.ts`) and the "SI: Super Intelligence" marketing claim.
- Set up a custom domain and a verified email sending domain (Supabase auth emails + Resend).
- Run the RLS check: sign in as two users and confirm neither sees the other's private deals, then add one to the other's team and confirm only team deals are shared.
