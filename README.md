# WeStor DealFlow

Acquisition intelligence for self storage. Find deals, underwrite them in seconds, match them to buyers, and produce compliant offering materials.

Next.js (App Router) · TypeScript strict · Tailwind v4 · Supabase · Stripe · Anthropic Claude · Resend · PostHog · Vitest · Playwright.

## Quick start (demo mode, no accounts needed)

```bash
npm install
npm run dev        # http://localhost:3000 → "Enter the demo workspace"
```

With no Supabase keys, the app runs on an in-memory store seeded with West San Antonio Storage and four sample deals. Click **Unlock for $49/month** to simulate the Pro upgrade. Data resets when the server restarts.

## Going live

1. **Supabase**: create a project, then run the migrations in `supabase/migrations` (`supabase db push`, or paste them into the SQL editor in order).
   - Auth → Providers: enable Email (magic link) and Google.
   - Auth → URL configuration: add `https://YOUR_DOMAIN/auth/callback`.
   - The migration creates the private `deal-files` storage bucket.
2. **Stripe** (test mode first): create a product "WeStor Pro" with a $49/month price and put its ID in `STRIPE_PRICE_PRO_MONTHLY`. Add a webhook to `https://YOUR_DOMAIN/api/stripe/webhook` for `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` and `invoice.payment_failed`. Turn on the customer portal (allow cancel and card update).
3. **Anthropic**: set `ANTHROPIC_API_KEY`. `ANTHROPIC_MODEL` defaults to `claude-sonnet-5-5`.
4. **Resend inbound**: route `alerts+*@YOUR_INBOUND_DOMAIN` to `POST https://YOUR_DOMAIN/api/inbound/email` with header `x-inbound-secret: $RESEND_INBOUND_SECRET`. Set `RESEND_INBOUND_DOMAIN`.
5. **PostHog**: set `NEXT_PUBLIC_POSTHOG_KEY` (optional).
6. **Vercel**: import the GitHub repo, add every variable from `.env.example`, and deploy.

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

- `lib/underwriting.ts`: every money calculation (tested against the San Antonio numbers)
- `lib/om/`: OM extraction schema and prompt, the deterministic red-flag checks, review mapping
- `lib/matching.ts`: buyer scoring
- `lib/pipeline.ts`: the contract gate and the OM compliance gate
- `lib/docs/`: preview and OM models (pure, tested) and PDF rendering
- `lib/server/gate.ts`: `requirePro` and the AI rate limit. Every Pro route and action calls it.
- `lib/billing/plans.ts`: plan config. Add tiers here.
- `supabase/migrations/`: schema, RLS and the sign-up trigger

## Before charging real customers

- Switch Stripe to live mode (new keys, live price ID, live webhook secret).
- Have an attorney review the Terms, Privacy Policy, the pre-contract preview wording and the equitable-interest disclosure (`lib/docs/models.ts`).
- Set up a custom domain and a verified email sending domain (Supabase auth emails + Resend).
- Run the RLS check: sign in as two users and confirm neither sees the other's deals.
