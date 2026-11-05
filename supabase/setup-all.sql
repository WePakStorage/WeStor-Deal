-- UndrIq: complete database setup in ONE file, for a NEW Supabase project.
-- Paste into Supabase → SQL Editor → New query → Run. Run it once.
-- (Generated from supabase/migrations 0001-0008; if some of those already ran, run the remaining files one by one instead.)


-- ===================== 20261104000001_init.sql =====================
-- WeStor DealFlow initial schema
create extension if not exists pgcrypto;

-- updated_at helper
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

-- ───────────────────────── orgs / profiles / subscriptions
create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null default 'My firm',
  brand_name text not null default '',
  brand_tagline text not null default '',
  contact_name text not null default '',
  contact_phone text not null default '',
  contact_email text not null default '',
  disclosure_entity text not null default '',
  logo_url text,
  inbound_token text not null unique default encode(gen_random_bytes(9), 'hex'),
  defaults jsonb not null default '{"down_pct":0.3,"rate":0.075,"years":20,"target_dscr":1.25,"target_cap":0.085,"assignment_fee":25000}'
);

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  role text not null default 'owner' check (role in ('owner','member'))
);
create index on public.profiles(org_id);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  org_id uuid not null unique references public.orgs(id) on delete cascade,
  stripe_customer_id text unique,
  stripe_subscription_id text,
  plan text not null default 'free' check (plan in ('free','pro')),
  status text not null default 'none',
  current_period_end timestamptz
);

-- Pending team invites (seat limit enforced in app code)
create table public.org_invites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  unique (org_id, email)
);

-- The caller's org, used by every RLS policy
create or replace function public.auth_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where user_id = auth.uid()
$$;

-- ───────────────────────── deals and children
create table public.deals (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  market_city text not null default '',
  market_state text not null default '',
  address text,
  property_type text not null default 'drive_up' check (property_type in ('drive_up','climate','mixed','rv_boat')),
  units int,
  nrsf int,
  acres numeric,
  buildings int,
  year_built int,
  physical_occupancy numeric,
  list_price numeric,
  target_price numeric,
  appraised_value numeric,
  appraisal_date date,
  stage text not null default 'sourced' check (stage in ('sourced','underwriting','negotiating','under_contract','assigned','closed','dead')),
  contract_signed_at date,
  contract_price numeric,
  assignable boolean not null default false,
  notes text not null default '',
  is_sample boolean not null default false,
  construction text,
  listing_url text,
  om_narrative text,
  sources jsonb not null default '{}',
  -- A deal can only sit in Under contract / Assigned with a recorded contract
  constraint contract_required check (
    stage not in ('under_contract','assigned') or (contract_signed_at is not null and contract_price is not null)
  )
);
create index on public.deals(org_id, stage);

create table public.deal_financials (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  period text not null check (period in ('actual_year','t12','year1_proj')),
  period_label text not null default '',
  potential_rent numeric,
  vacancy numeric,
  other_income numeric,
  egi numeric,
  expenses jsonb not null default '[]',
  total_expenses numeric,
  noi numeric,
  source text not null default 'user' check (source in ('seller','broker_om','appraisal','user','calculated')),
  unique (deal_id, period)
);

create table public.unit_mix (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  unit_type text not null,
  width numeric not null default 0,
  depth numeric not null default 0,
  count int not null default 0,
  occupied int not null default 0,
  street_rent numeric not null default 0,
  in_place_rent numeric not null default 0,
  climate boolean not null default false
);
create index on public.unit_mix(deal_id);

create table public.deal_flags (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  level text not null check (level in ('warn','info','ok')),
  code text not null,
  message text not null,
  source text not null default 'checks'
);
create index on public.deal_flags(deal_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  kind text not null check (kind in ('broker_om','appraisal','t12','rent_roll','generated_om','generated_preview')),
  name text not null default '',
  storage_path text not null,
  parsed boolean not null default false,
  parse_status text not null default 'n/a',
  parse_error text,
  extraction jsonb
);
create index on public.documents(deal_id);

-- ───────────────────────── buyers
create table public.buyers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  firm_name text not null,
  contact_name text not null default '',
  email text not null default '',
  phone text not null default '',
  buyer_type text not null default 'private_operator' check (buyer_type in ('private_operator','fund','reit','individual')),
  accepts_assignment boolean not null default true,
  states text[] not null default '{}',
  min_price numeric,
  max_price numeric,
  min_nrsf int,
  max_nrsf int,
  property_types text[] not null default '{}',
  strategy text not null default 'any' check (strategy in ('value_add','stabilized','any')),
  financing text not null default 'either' check (financing in ('cash','debt','either')),
  notes text not null default ''
);
create index on public.buyers(org_id);

create table public.deal_buyer_matches (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  buyer_id uuid not null references public.buyers(id) on delete cascade,
  score int not null default 0 check (score between 0 and 100),
  reasons jsonb not null default '[]',
  status text not null default 'suggested' check (status in ('suggested','contacted','interested','passed')),
  unique (deal_id, buyer_id)
);

-- ───────────────────────── tasks, activity, usage
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  deal_id uuid not null references public.deals(id) on delete cascade,
  title text not null,
  due_date date,
  done boolean not null default false,
  assignee text
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete cascade,
  actor text not null default '',
  action text not null,
  payload jsonb not null default '{}'
);
create index on public.activity_log(org_id, deal_id, created_at desc);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  kind text not null check (kind in ('om_parse','doc_generate','alert_parse')),
  tokens_in int not null default 0,
  tokens_out int not null default 0
);
create index on public.usage_events(org_id, created_at desc);

-- Off-market finder (appraisal-district CSV imports)
create table public.sourcing_candidates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  county text not null,
  parcel_id text not null default '',
  owner_name text not null default '',
  owner_type text not null default 'individual' check (owner_type in ('individual','small_llc','institutional')),
  situs_city text not null default '',
  situs_state text not null default '',
  building_sf int,
  year_built int,
  years_owned numeric,
  tax_delinquent boolean not null default false,
  lat double precision,
  lng double precision,
  score int not null default 0,
  reasons jsonb not null default '[]',
  added_deal_id uuid references public.deals(id) on delete set null
);
create index on public.sourcing_candidates(org_id, county);

-- ───────────────────────── updated_at triggers
do $$
declare t text;
begin
  foreach t in array array['orgs','profiles','subscriptions','org_invites','deals','deal_financials','unit_mix','deal_flags','documents','buyers','deal_buyer_matches','tasks','activity_log','usage_events','sourcing_candidates']
  loop
    execute format('create trigger touch_%1$s before update on public.%1$s for each row execute function public.touch_updated_at()', t);
  end loop;
end $$;

-- ───────────────────────── Row Level Security
alter table public.orgs enable row level security;
create policy org_read on public.orgs for select using (id = public.auth_org_id());
create policy org_update on public.orgs for update using (id = public.auth_org_id());

alter table public.profiles enable row level security;
create policy profile_read on public.profiles for select using (org_id = public.auth_org_id());
create policy profile_update_self on public.profiles for update using (user_id = auth.uid());

-- Subscriptions: read-only for members. Writes happen only from the Stripe webhook (service role).
alter table public.subscriptions enable row level security;
create policy sub_read on public.subscriptions for select using (org_id = public.auth_org_id());

-- Usage: read-only for members, written by server (service role).
alter table public.usage_events enable row level security;
create policy usage_read on public.usage_events for select using (org_id = public.auth_org_id());

do $$
declare t text;
begin
  foreach t in array array['org_invites','deals','deal_financials','unit_mix','deal_flags','documents','buyers','deal_buyer_matches','tasks','activity_log','sourcing_candidates']
  loop
    execute format('alter table public.%1$s enable row level security', t);
    execute format('create policy %1$s_org on public.%1$s for all using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id())', t);
  end loop;
end $$;

-- ───────────────────────── First login: create org, profile, free subscription
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  new_org uuid;
  invite record;
  display_name text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
begin
  select * into invite from public.org_invites where lower(email) = lower(new.email) limit 1;
  if found then
    insert into public.profiles(user_id, org_id, full_name, email, role)
      values (new.id, invite.org_id, coalesce(nullif(invite.full_name, ''), display_name), new.email, 'member');
    delete from public.org_invites where id = invite.id;
    return new;
  end if;

  insert into public.orgs(name, brand_name, contact_name, contact_email)
    values (display_name || '''s firm', '', display_name, new.email)
    returning id into new_org;
  insert into public.profiles(user_id, org_id, full_name, email, role)
    values (new.id, new_org, display_name, new.email, 'owner');
  insert into public.subscriptions(org_id) values (new_org);
  perform public.seed_org(new_org);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ───────────────────────── Storage bucket for PDFs (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('deal-files', 'deal-files', false, 26214400, array['application/pdf'])
on conflict (id) do nothing;

create policy deal_files_rw on storage.objects for all
  using (bucket_id = 'deal-files' and (storage.foldername(name))[1] = public.auth_org_id()::text)
  with check (bucket_id = 'deal-files' and (storage.foldername(name))[1] = public.auth_org_id()::text);

-- ===================== 20261104000002_seed_org.sql =====================
-- GENERATED by scripts/gen-seed-sql.mts. Do not edit by hand.
create or replace function public.seed_org(target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  d0 uuid := gen_random_uuid();
  d1 uuid := gen_random_uuid();
  d2 uuid := gen_random_uuid();
  d3 uuid := gen_random_uuid();
  d4 uuid := gen_random_uuid();
begin
  insert into deals(id, org_id, name, market_city, market_state, address, property_type, units, nrsf, acres, buildings, year_built, physical_occupancy, list_price, target_price, appraised_value, appraisal_date, stage, contract_signed_at, contract_price, assignable, notes, is_sample, construction, sources) values (d0, target, 'West San Antonio Storage', 'San Antonio', 'TX', '4810 Sample Rd, San Antonio, TX 78227', 'drive_up', 87, 21650, 1.5, 4, 1960, 0.8390804597701149, 760000, 715000, 725000, '2026-08-15', 'negotiating', null, null, false, 'Seller open to a 30-day close. 10x30s are under-rented and 12 are vacant.', false, 'Metal over steel and wood frame, gravel floors and drives', '{"units":"seller","nrsf":"seller","acres":"appraisal","year_built":"appraisal","physical_occupancy":"seller","list_price":"broker_om","target_price":"user","appraised_value":"appraisal"}'::jsonb);
  insert into deals(id, org_id, name, market_city, market_state, address, property_type, units, nrsf, acres, buildings, year_built, physical_occupancy, list_price, target_price, appraised_value, appraisal_date, stage, contract_signed_at, contract_price, assignable, notes, is_sample, construction, sources) values (d1, target, 'Ocala Drive-Up Storage', 'Ocala', 'FL', null, 'drive_up', 120, 14800, null, null, 1998, 0.88, 1150000, 980000, null, null, 'sourced', null, null, false, '', true, null, '{}'::jsonb);
  insert into deals(id, org_id, name, market_city, market_state, address, property_type, units, nrsf, acres, buildings, year_built, physical_occupancy, list_price, target_price, appraised_value, appraisal_date, stage, contract_signed_at, contract_price, assignable, notes, is_sample, construction, sources) values (d2, target, 'Baton Rouge Mini Storage', 'Baton Rouge', 'LA', null, 'mixed', 210, 31500, null, null, 2004, 0.91, 2400000, 2050000, null, null, 'underwriting', null, null, false, '', true, null, '{}'::jsonb);
  insert into deals(id, org_id, name, market_city, market_state, address, property_type, units, nrsf, acres, buildings, year_built, physical_occupancy, list_price, target_price, appraised_value, appraisal_date, stage, contract_signed_at, contract_price, assignable, notes, is_sample, construction, sources) values (d3, target, 'Akron RV & Storage', 'Akron', 'OH', null, 'rv_boat', 95, 18200, null, null, 1987, 0.82, 890000, 800000, null, null, 'underwriting', null, null, false, '', true, null, '{}'::jsonb);
  insert into deals(id, org_id, name, market_city, market_state, address, property_type, units, nrsf, acres, buildings, year_built, physical_occupancy, list_price, target_price, appraised_value, appraisal_date, stage, contract_signed_at, contract_price, assignable, notes, is_sample, construction, sources) values (d4, target, 'Lakeland Self Storage', 'Lakeland', 'FL', null, 'climate', 160, 26000, null, null, 2008, 0.93, 1950000, 1780000, null, null, 'under_contract', '2026-09-20', 1760000, true, '', true, null, '{}'::jsonb);
  insert into deal_financials(org_id, deal_id, period, period_label, potential_rent, vacancy, other_income, egi, expenses, total_expenses, noi, source) values (target, d0, 'actual_year', '2025 actual', 142740, 10392, 0, 132348, '[]'::jsonb, 31180, 101168, 'seller');
  insert into deal_financials(org_id, deal_id, period, period_label, potential_rent, vacancy, other_income, egi, expenses, total_expenses, noi, source) values (target, d0, 't12', 'T-12', 142740, 38120, 0, 104620, '[{"label":"Taxes","amount":11427},{"label":"Insurance","amount":9151},{"label":"Utilities","amount":1955},{"label":"Repairs","amount":4401},{"label":"Management software","amount":7164},{"label":"Bank charges","amount":3471},{"label":"Dumpster","amount":1938},{"label":"Marketing","amount":0}]'::jsonb, 39507, 65113, 'seller');
  insert into deal_financials(org_id, deal_id, period, period_label, potential_rent, vacancy, other_income, egi, expenses, total_expenses, noi, source) values (target, d0, 'year1_proj', 'Year 1 projected', 142740, 21411, 1800, 123129, '[]'::jsonb, 47288, 75841, 'broker_om');
  insert into deal_financials(org_id, deal_id, period, period_label, potential_rent, vacancy, other_income, egi, expenses, total_expenses, noi, source) values (target, d1, 't12', 'T-12', null, null, null, 132000, '[]'::jsonb, 44000, 88000, 'broker_om');
  insert into deal_financials(org_id, deal_id, period, period_label, potential_rent, vacancy, other_income, egi, expenses, total_expenses, noi, source) values (target, d2, 't12', 'T-12', null, null, null, 262000, '[]'::jsonb, 91000, 171000, 'broker_om');
  insert into deal_financials(org_id, deal_id, period, period_label, potential_rent, vacancy, other_income, egi, expenses, total_expenses, noi, source) values (target, d3, 't12', 'T-12', null, null, null, 104000, '[]'::jsonb, 33600, 70400, 'broker_om');
  insert into deal_financials(org_id, deal_id, period, period_label, potential_rent, vacancy, other_income, egi, expenses, total_expenses, noi, source) values (target, d4, 't12', 'T-12', null, null, null, 228000, '[]'::jsonb, 76000, 152000, 'broker_om');
  insert into unit_mix(org_id, deal_id, unit_type, width, depth, count, occupied, street_rent, in_place_rent, climate) values (target, d0, '10x20 NC', 10, 20, 36, 34, 125, 116, false);
  insert into unit_mix(org_id, deal_id, unit_type, width, depth, count, occupied, street_rent, in_place_rent, climate) values (target, d0, '10x25 NC', 10, 25, 17, 17, 145, 135, false);
  insert into unit_mix(org_id, deal_id, unit_type, width, depth, count, occupied, street_rent, in_place_rent, climate) values (target, d0, '10x30 NC', 10, 30, 34, 22, 145, 122, false);
  insert into buyers(org_id, firm_name, contact_name, email, phone, buyer_type, accepts_assignment, states, min_price, max_price, min_nrsf, max_nrsf, property_types, strategy, financing, notes) values (target, 'Lone Star Storage Partners', 'Dana Ortiz', 'dana@lonestarsp.example', '', 'private_operator', true, array['TX','OK']::text[], 500000, 3000000, 15000, 80000, array['drive_up','mixed']::text[], 'value_add', 'debt', '');
  insert into buyers(org_id, firm_name, contact_name, email, phone, buyer_type, accepts_assignment, states, min_price, max_price, min_nrsf, max_nrsf, property_types, strategy, financing, notes) values (target, 'Gulf Coast Self Storage Fund II', 'Marcus Hale', 'mhale@gcssf.example', '', 'fund', true, array['TX','LA','FL']::text[], 1500000, 8000000, 25000, 150000, array['climate','mixed']::text[], 'stabilized', 'debt', '');
  insert into buyers(org_id, firm_name, contact_name, email, phone, buyer_type, accepts_assignment, states, min_price, max_price, min_nrsf, max_nrsf, property_types, strategy, financing, notes) values (target, 'Redline Holdings', 'Priya Nair', 'priya@redline.example', '', 'individual', false, array['TX']::text[], 300000, 1200000, null, null, array['drive_up']::text[], 'value_add', 'cash', '');
  insert into buyers(org_id, firm_name, contact_name, email, phone, buyer_type, accepts_assignment, states, min_price, max_price, min_nrsf, max_nrsf, property_types, strategy, financing, notes) values (target, 'Sunshine State Storage Co.', 'Tom Becker', 'tom@sssc.example', '', 'private_operator', true, array['FL','GA']::text[], 750000, 2500000, 12000, 40000, array['drive_up','climate']::text[], 'any', 'either', '');
end $$;

-- ===================== 20261105000003_undriq_spaces.sql =====================
-- UndrIq: four plans, private personal spaces, shared team spaces (Firm 5 seats, Fund 15),
-- AI deal analyses with offers, and per-space buy box rules.
--
-- Model: every user owns exactly one PERSONAL org (their private pipeline and buyer list).
-- Firm and Fund owners can create TEAM orgs and add people. profiles.org_id is the ACTIVE space;
-- every existing RLS policy keys off auth_org_id(), which now only resolves to a space the caller
-- is a current member of. Switching spaces goes through switch_space(), never a direct update.

-- ───────────────────────── Plans
update public.subscriptions set plan = 'investor' where plan = 'pro';
alter table public.subscriptions drop constraint if exists subscriptions_plan_check;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('free','investor','firm','fund'));

-- ───────────────────────── Spaces
alter table public.orgs
  add column if not exists kind text not null default 'personal' check (kind in ('personal','team')),
  add column if not exists owner_user_id uuid references auth.users(id) on delete cascade,
  add column if not exists buy_box jsonb not null default '{}';

alter table public.profiles add column if not exists personal_org_id uuid references public.orgs(id) on delete set null;

create table if not exists public.org_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  unique (org_id, user_id)
);
create index if not exists org_members_user on public.org_members(user_id);
create trigger touch_org_members before update on public.org_members for each row execute function public.touch_updated_at();

-- Backfill: owners keep their org as their personal space. Orgs that already had members
-- become team spaces, and each of those members gets a fresh personal space.
update public.orgs o set owner_user_id = p.user_id from public.profiles p where p.org_id = o.id and p.role = 'owner' and o.owner_user_id is null;
insert into public.org_members(org_id, user_id, role) select org_id, user_id, role from public.profiles on conflict do nothing;
update public.orgs set kind = 'team' where id in (select org_id from public.profiles where role = 'member');
update public.profiles set personal_org_id = org_id where role = 'owner' and personal_org_id is null
  and org_id not in (select id from public.orgs where kind = 'team');
do $$
declare r record; new_org uuid;
begin
  for r in select * from public.profiles where personal_org_id is null loop
    insert into public.orgs(name, kind, owner_user_id, contact_name, contact_email)
      values (coalesce(nullif(r.full_name, ''), split_part(r.email, '@', 1)) || '''s space', 'personal', r.user_id, r.full_name, r.email)
      returning id into new_org;
    insert into public.org_members(org_id, user_id, role) values (new_org, r.user_id, 'owner');
    insert into public.subscriptions(org_id) values (new_org) on conflict do nothing;
    update public.profiles set personal_org_id = new_org where id = r.id;
  end loop;
end $$;

-- ───────────────────────── Helpers (security definer: they read across orgs without RLS recursion)
create or replace function public.is_member(target uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_members where org_id = target and user_id = auth.uid())
$$;

-- Active space if the caller is still a member of it, else their personal space.
create or replace function public.auth_org_id() returns uuid
language sql stable security definer set search_path = public as $$
  select case when exists (select 1 from public.org_members m where m.org_id = p.org_id and m.user_id = p.user_id)
              then p.org_id else p.personal_org_id end
  from public.profiles p where p.user_id = auth.uid()
$$;

create or replace function public.plan_rank(p text) returns int language sql immutable as $$
  select case p when 'investor' then 1 when 'firm' then 2 when 'fund' then 3 else 0 end
$$;

-- Paid plan of a user's personal space (paid statuses only; mirrors lib/billing/plans.ts).
create or replace function public.user_plan(uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((
    select s.plan from public.profiles p join public.subscriptions s on s.org_id = p.personal_org_id
    where p.user_id = uid and s.status in ('active','trialing','past_due')
  ), 'free')
$$;

-- A space's plan: the better of its own subscription and (for teams) its owner's personal plan.
create or replace function public.space_plan(target uuid) returns text
language sql stable security definer set search_path = public as $$
  with own as (
    select coalesce((select plan from public.subscriptions where org_id = target and status in ('active','trialing','past_due')), 'free') as p
  ), owner as (
    select case when o.kind = 'team' and o.owner_user_id is not null then public.user_plan(o.owner_user_id) else 'free' end as p
    from public.orgs o where o.id = target
  )
  select case when public.plan_rank(own.p) >= public.plan_rank(coalesce(owner.p, 'free')) then own.p else owner.p end from own left join owner on true
$$;

create or replace function public.seat_limit(target uuid) returns int
language sql stable security definer set search_path = public as $$
  select case public.space_plan(target) when 'fund' then 15 when 'firm' then 5 else 1 end
$$;

-- Seats are enforced in the database too, so no client path can overfill a team.
create or replace function public.enforce_seats() returns trigger
language plpgsql security definer set search_path = public as $$
declare used int; k text;
begin
  select kind into k from public.orgs where id = new.org_id;
  if k <> 'team' then return new; end if;
  select (select count(*) from public.org_members where org_id = new.org_id)
       + (select count(*) from public.org_invites where org_id = new.org_id) into used;
  if used >= public.seat_limit(new.org_id) then
    raise exception 'This team is full (% seats). Fund teams get up to 15.', public.seat_limit(new.org_id) using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists enforce_seats_members on public.org_members;
create trigger enforce_seats_members before insert on public.org_members for each row execute function public.enforce_seats();
drop trigger if exists enforce_seats_invites on public.org_invites;
create trigger enforce_seats_invites before insert on public.org_invites for each row execute function public.enforce_seats();

-- ───────────────────────── Space actions (RPC). All checks happen here, on the server.
create or replace function public.switch_space(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member(target) then raise exception 'You are not a member of that space.' using errcode = '42501'; end if;
  update public.profiles set org_id = target where user_id = auth.uid();
end $$;

create or replace function public.create_team(team_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_org uuid; me record;
begin
  if public.plan_rank(public.user_plan(auth.uid())) < 2 then
    raise exception 'Team spaces come with Firm and Fund.' using errcode = '42501';
  end if;
  if (select count(*) from public.orgs where owner_user_id = auth.uid() and kind = 'team') >= 3 then
    raise exception 'You can own up to 3 team spaces.' using errcode = 'P0001';
  end if;
  select * into me from public.profiles where user_id = auth.uid();
  insert into public.orgs(name, kind, owner_user_id, contact_name, contact_email)
    values (coalesce(nullif(trim(team_name), ''), 'Team'), 'team', auth.uid(), me.full_name, me.email) returning id into new_org;
  insert into public.org_members(org_id, user_id, role) values (new_org, auth.uid(), 'owner');
  insert into public.subscriptions(org_id) values (new_org);
  return new_org;
end $$;

-- Add someone by email. Existing users join at once; new emails wait as invites and join on sign-up.
create or replace function public.invite_to_team(target uuid, invite_email text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid; e text := lower(trim(invite_email));
begin
  if not exists (select 1 from public.orgs where id = target and kind = 'team' and owner_user_id = auth.uid()) then
    raise exception 'Only the team owner can add people.' using errcode = '42501';
  end if;
  if e !~ '^[^@\s]+@[^@\s]+\.[^@\s]{2,}$' then raise exception 'Enter a valid email address.' using errcode = '22023'; end if;
  select user_id into uid from public.profiles where lower(email) = e limit 1;
  if uid is not null then
    if exists (select 1 from public.org_members where org_id = target and user_id = uid) then return 'already'; end if;
    insert into public.org_members(org_id, user_id, role) values (target, uid, 'member');
    return 'added';
  end if;
  if exists (select 1 from public.org_invites where org_id = target and lower(email) = e) then return 'already'; end if;
  insert into public.org_invites(org_id, email) values (target, e);
  return 'invited';
end $$;

-- Owner removes a member, or a member leaves (uid = self). The owner cannot leave their own team.
create or replace function public.remove_from_team(target uuid, uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare owner uuid;
begin
  select owner_user_id into owner from public.orgs where id = target and kind = 'team';
  if owner is null then raise exception 'Team not found.' using errcode = '42704'; end if;
  if uid = owner then raise exception 'The owner can''t leave. Delete the team instead.' using errcode = '42501'; end if;
  if auth.uid() <> owner and auth.uid() <> uid then raise exception 'Only the team owner can remove people.' using errcode = '42501'; end if;
  delete from public.org_members where org_id = target and user_id = uid;
  update public.profiles set org_id = personal_org_id where user_id = uid and org_id = target;
end $$;

create or replace function public.revoke_invite(target uuid, invite_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.orgs where id = target and owner_user_id = auth.uid()) then
    raise exception 'Only the team owner can revoke invites.' using errcode = '42501';
  end if;
  delete from public.org_invites where org_id = target and lower(email) = lower(invite_email);
end $$;

create or replace function public.delete_team(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.orgs where id = target and kind = 'team' and owner_user_id = auth.uid()) then
    raise exception 'Only the team owner can delete it.' using errcode = '42501';
  end if;
  update public.profiles set org_id = personal_org_id where org_id = target;
  delete from public.orgs where id = target;
end $$;

revoke all on function public.switch_space(uuid), public.create_team(text), public.invite_to_team(uuid, text),
  public.remove_from_team(uuid, uuid), public.revoke_invite(uuid, text), public.delete_team(uuid) from public, anon;
grant execute on function public.switch_space(uuid), public.create_team(text), public.invite_to_team(uuid, text),
  public.remove_from_team(uuid, uuid), public.revoke_invite(uuid, text), public.delete_team(uuid) to authenticated;

-- ───────────────────────── Sign-up: always a personal space; pending invites become memberships.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  new_org uuid;
  inv record;
  display_name text := coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1));
begin
  insert into public.orgs(name, kind, owner_user_id, contact_name, contact_email)
    values (display_name || '''s space', 'personal', new.id, display_name, new.email) returning id into new_org;
  insert into public.profiles(user_id, org_id, personal_org_id, full_name, email, role)
    values (new.id, new_org, new_org, display_name, new.email, 'owner');
  insert into public.org_members(org_id, user_id, role) values (new_org, new.id, 'owner');
  insert into public.subscriptions(org_id) values (new_org);
  perform public.seed_org(new_org);
  for inv in select * from public.org_invites where lower(email) = lower(new.email) loop
    -- Delete the invite first so the seat it held frees up for the membership.
    delete from public.org_invites where id = inv.id;
    begin
      insert into public.org_members(org_id, user_id, role) values (inv.org_id, new.id, 'member');
    exception when others then null; -- team filled up meanwhile; the person still gets their own space
    end;
  end loop;
  return new;
end $$;

-- ───────────────────────── Lock profile columns: users may change their name, nothing else.
revoke update on public.profiles from authenticated;
grant update (full_name) on public.profiles to authenticated;

-- ───────────────────────── RLS for spaces
drop policy if exists org_read on public.orgs;
create policy org_read on public.orgs for select using (public.is_member(id));
alter table public.org_members enable row level security;
create policy members_read on public.org_members for select using (user_id = auth.uid() or org_id = public.auth_org_id());
-- No insert/update/delete policies: membership changes only through the functions above.

-- ───────────────────────── AI analyses (the UndrIq pipeline) with offers
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  asset text not null check (asset in ('residential','multifamily','storage','industrial','commercial')),
  property_type text not null,
  city text,
  state text,
  listing_url text,
  stage text not null default 'analyzed' check (stage in ('analyzed','offer_sent','negotiating','under_contract','closed','dead')),
  score int not null default 0 check (score between 0 and 100),
  facts jsonb not null,
  result jsonb not null,
  memo jsonb,
  motivation jsonb,
  offers jsonb not null default '[]',
  notes text not null default ''
);
create index on public.analyses(org_id, updated_at desc);
create trigger touch_analyses before update on public.analyses for each row execute function public.touch_updated_at();
alter table public.analyses enable row level security;
create policy analyses_org on public.analyses for all using (org_id = public.auth_org_id()) with check (org_id = public.auth_org_id());

-- Usage kinds for quota counting
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events add constraint usage_events_kind_check check (kind in ('om_parse','doc_generate','alert_parse','analysis'));
alter table public.usage_events add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists usage_kind on public.usage_events(org_id, kind, created_at desc);

-- ───────────────────────── Lock org columns: kind, owner and inbound token are never client-writable.
revoke update on public.orgs from authenticated;
grant update (name, brand_name, brand_tagline, contact_name, contact_phone, contact_email, disclosure_entity, logo_url, defaults) on public.orgs to authenticated;
-- buy_box is written by the server after the Fund feature check (see lib/actions/undriq.ts), via set_buy_box.
create or replace function public.set_buy_box(rules jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.plan_rank(public.space_plan(public.auth_org_id())) < 3 then
    raise exception 'Buy box rules come with Fund.' using errcode = '42501';
  end if;
  update public.orgs set buy_box = coalesce(rules, '{}') where id = public.auth_org_id();
end $$;

-- People in a space (profiles RLS only shows people whose active space matches yours).
create or replace function public.space_members(target uuid)
returns table (user_id uuid, full_name text, email text, role text, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.full_name, p.email, m.role, m.created_at
  from public.org_members m join public.profiles p on p.user_id = m.user_id
  where m.org_id = target and public.is_member(target)
  order by m.role desc, m.created_at
$$;

-- The caller's spaces, for the switcher.
create or replace function public.my_spaces()
returns table (org_id uuid, name text, kind text, role text, owner_user_id uuid, plan text)
language sql stable security definer set search_path = public as $$
  select o.id, o.name, o.kind, m.role, o.owner_user_id, public.space_plan(o.id)
  from public.org_members m join public.orgs o on o.id = m.org_id
  where m.user_id = auth.uid()
  order by (o.kind = 'personal') desc, o.created_at
$$;

-- Usage rows for AI analyses. Callers can only add usage to their own active space (it only spends their quota).
create or replace function public.record_usage(usage_kind text, t_in int, t_out int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if usage_kind not in ('analysis','om_parse','doc_generate','alert_parse') then raise exception 'bad kind'; end if;
  insert into public.usage_events(org_id, user_id, kind, tokens_in, tokens_out) values (public.auth_org_id(), auth.uid(), usage_kind, greatest(t_in, 0), greatest(t_out, 0));
end $$;

grant execute on function public.set_buy_box(jsonb), public.space_members(uuid), public.my_spaces(), public.record_usage(text, int, int) to authenticated;
revoke execute on function public.set_buy_box(jsonb), public.space_members(uuid), public.my_spaces(), public.record_usage(text, int, int) from anon;

-- Plan helpers are internal: RLS and the functions above call them as definer. The app reads plans
-- through my_spaces() or the service role, so nobody can probe another user's plan.
revoke execute on function public.user_plan(uuid), public.space_plan(uuid), public.seat_limit(uuid) from public, anon, authenticated;

create or replace function public.rename_team(target uuid, team_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.orgs where id = target and kind = 'team' and owner_user_id = auth.uid()) then
    raise exception 'Only the team owner can rename it.' using errcode = '42501';
  end if;
  update public.orgs set name = left(coalesce(nullif(trim(team_name), ''), 'Team'), 80) where id = target;
end $$;
revoke all on function public.rename_team(uuid, text) from public, anon;
grant execute on function public.rename_team(uuid, text) to authenticated;

-- Pending invites a team owner can see (org_invites RLS already scopes to the active space).
create policy profile_read_self on public.profiles for select using (user_id = auth.uid());
grant execute on function public.space_plan(uuid) to service_role;

-- ===================== 20261105000004_seed_org_fix.sql =====================
-- GENERATED by scripts/gen-seed-sql.mts. Do not edit by hand.
create or replace function public.seed_org(target uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  d0 uuid := gen_random_uuid();
  d1 uuid := gen_random_uuid();
  d2 uuid := gen_random_uuid();
  d3 uuid := gen_random_uuid();
  d4 uuid := gen_random_uuid();
begin
  insert into deals(id, org_id, name, market_city, market_state, address, property_type, units, nrsf, acres, buildings, year_built, physical_occupancy, list_price, target_price, appraised_value, appraisal_date, stage, contract_signed_at, contract_price, assignable, notes, is_sample, construction, sources) values (d0, target, 'West San Antonio Storage', 'San Antonio', 'TX', '4810 Sample Rd, San Antonio, TX 78227', 'drive_up', 87, 21650, 1.5, 4, 1960, 0.8390804597701149, 760000, 715000, 725000, '2026-08-15', 'negotiating', null, null, false, 'Seller open to a 30-day close. 10x30s are under-rented and 12 are vacant.', false, 'Metal over steel and wood frame, gravel floors and drives', '{"units":"seller","nrsf":"seller","acres":"appraisal","year_built":"appraisal","physical_occupancy":"seller","list_price":"broker_om","target_price":"user","appraised_value":"appraisal"}'::jsonb);
  insert into deals(id, org_id, name, market_city, market_state, address, property_type, units, nrsf, acres, buildings, year_built, physical_occupancy, list_price, target_price, appraised_value, appraisal_date, stage, contract_signed_at, contract_price, assignable, notes, is_sample, construction, sources) values (d1, target, 'Ocala Drive-Up Storage', 'Ocala', 'FL', null, 'drive_up', 120, 14800, null, null, 1998, 0.88, 1150000, 980000, null, null, 'sourced', null, null, false, '', true, null, '{}'::jsonb);
  insert into deals(id, org_id, name, market_city, market_state, address, property_type, units, nrsf, acres, buildings, year_built, physical_occupancy, list_price, target_price, appraised_value, appraisal_date, stage, contract_signed_at, contract_price, assignable, notes, is_sample, construction, sources) values (d2, target, 'Baton Rouge Mini Storage', 'Baton Rouge', 'LA', null, 'mixed', 210, 31500, null, null, 2004, 0.91, 2400000, 2050000, null, null, 'underwriting', null, null, false, '', true, null, '{}'::jsonb);
  insert into deals(id, org_id, name, market_city, market_state, address, property_type, units, nrsf, acres, buildings, year_built, physical_occupancy, list_price, target_price, appraised_value, appraisal_date, stage, contract_signed_at, contract_price, assignable, notes, is_sample, construction, sources) values (d3, target, 'Akron RV & Storage', 'Akron', 'OH', null, 'rv_boat', 95, 18200, null, null, 1987, 0.82, 890000, 800000, null, null, 'underwriting', null, null, false, '', true, null, '{}'::jsonb);
  insert into deals(id, org_id, name, market_city, market_state, address, property_type, units, nrsf, acres, buildings, year_built, physical_occupancy, list_price, target_price, appraised_value, appraisal_date, stage, contract_signed_at, contract_price, assignable, notes, is_sample, construction, sources) values (d4, target, 'Lakeland Self Storage', 'Lakeland', 'FL', null, 'climate', 160, 26000, null, null, 2008, 0.93, 1950000, 1780000, null, null, 'under_contract', '2026-09-20', 1760000, true, '', true, null, '{}'::jsonb);
  insert into deal_financials(org_id, deal_id, period, period_label, potential_rent, vacancy, other_income, egi, expenses, total_expenses, noi, source) values (target, d0, 'actual_year', '2025 actual', 142740, 10392, 0, 132348, '[]'::jsonb, 31180, 101168, 'seller');
  insert into deal_financials(org_id, deal_id, period, period_label, potential_rent, vacancy, other_income, egi, expenses, total_expenses, noi, source) values (target, d0, 't12', 'T-12', 142740, 38120, 0, 104620, '[{"label":"Taxes","amount":11427},{"label":"Insurance","amount":9151},{"label":"Utilities","amount":1955},{"label":"Repairs","amount":4401},{"label":"Management software","amount":7164},{"label":"Bank charges","amount":3471},{"label":"Dumpster","amount":1938},{"label":"Marketing","amount":0}]'::jsonb, 39507, 65113, 'seller');
  insert into deal_financials(org_id, deal_id, period, period_label, potential_rent, vacancy, other_income, egi, expenses, total_expenses, noi, source) values (target, d0, 'year1_proj', 'Year 1 projected', 142740, 21411, 1800, 123129, '[]'::jsonb, 47288, 75841, 'broker_om');
  insert into deal_financials(org_id, deal_id, period, period_label, potential_rent, vacancy, other_income, egi, expenses, total_expenses, noi, source) values (target, d1, 't12', 'T-12', null, null, null, 132000, '[]'::jsonb, 44000, 88000, 'broker_om');
  insert into deal_financials(org_id, deal_id, period, period_label, potential_rent, vacancy, other_income, egi, expenses, total_expenses, noi, source) values (target, d2, 't12', 'T-12', null, null, null, 262000, '[]'::jsonb, 91000, 171000, 'broker_om');
  insert into deal_financials(org_id, deal_id, period, period_label, potential_rent, vacancy, other_income, egi, expenses, total_expenses, noi, source) values (target, d3, 't12', 'T-12', null, null, null, 104000, '[]'::jsonb, 33600, 70400, 'broker_om');
  insert into deal_financials(org_id, deal_id, period, period_label, potential_rent, vacancy, other_income, egi, expenses, total_expenses, noi, source) values (target, d4, 't12', 'T-12', null, null, null, 228000, '[]'::jsonb, 76000, 152000, 'broker_om');
  insert into unit_mix(org_id, deal_id, unit_type, width, depth, count, occupied, street_rent, in_place_rent, climate) values (target, d0, '10x20 NC', 10, 20, 36, 34, 125, 116, false);
  insert into unit_mix(org_id, deal_id, unit_type, width, depth, count, occupied, street_rent, in_place_rent, climate) values (target, d0, '10x25 NC', 10, 25, 17, 17, 145, 135, false);
  insert into unit_mix(org_id, deal_id, unit_type, width, depth, count, occupied, street_rent, in_place_rent, climate) values (target, d0, '10x30 NC', 10, 30, 34, 22, 145, 122, false);
  insert into buyers(org_id, firm_name, contact_name, email, phone, buyer_type, accepts_assignment, states, min_price, max_price, min_nrsf, max_nrsf, property_types, strategy, financing, notes) values (target, 'Lone Star Storage Partners', 'Dana Ortiz', 'dana@lonestarsp.example', '', 'private_operator', true, array['TX','OK']::text[], 500000, 3000000, 15000, 80000, array['drive_up','mixed']::text[], 'value_add', 'debt', '');
  insert into buyers(org_id, firm_name, contact_name, email, phone, buyer_type, accepts_assignment, states, min_price, max_price, min_nrsf, max_nrsf, property_types, strategy, financing, notes) values (target, 'Gulf Coast Self Storage Fund II', 'Marcus Hale', 'mhale@gcssf.example', '', 'fund', true, array['TX','LA','FL']::text[], 1500000, 8000000, 25000, 150000, array['climate','mixed']::text[], 'stabilized', 'debt', '');
  insert into buyers(org_id, firm_name, contact_name, email, phone, buyer_type, accepts_assignment, states, min_price, max_price, min_nrsf, max_nrsf, property_types, strategy, financing, notes) values (target, 'Redline Holdings', 'Priya Nair', 'priya@redline.example', '', 'individual', false, array['TX']::text[], 300000, 1200000, null, null, array['drive_up']::text[], 'value_add', 'cash', '');
  insert into buyers(org_id, firm_name, contact_name, email, phone, buyer_type, accepts_assignment, states, min_price, max_price, min_nrsf, max_nrsf, property_types, strategy, financing, notes) values (target, 'Sunshine State Storage Co.', 'Tom Becker', 'tom@sssc.example', '', 'private_operator', true, array['FL','GA']::text[], 750000, 2500000, 12000, 40000, array['drive_up','climate']::text[], 'any', 'either', '');
end $$;

-- ===================== 20261105000005_property_lookups.sql =====================
-- RentCast property lookups: a shared cache of public property data keyed by normalized address,
-- so the same property is never paid for twice. Server (service role) only: no client policies.
create table if not exists public.property_lookups (
  address_key text primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  record jsonb not null,
  calls int not null default 0
);
create index if not exists property_lookups_created on public.property_lookups(created_at desc);
create trigger touch_property_lookups before update on public.property_lookups for each row execute function public.touch_updated_at();
alter table public.property_lookups enable row level security;
revoke all on public.property_lookups from anon, authenticated;

-- Every API call made is logged here (cache hits are not), for the monthly RentCast budget.
create table if not exists public.property_lookup_calls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  org_id uuid references public.orgs(id) on delete set null,
  calls int not null
);
create index if not exists property_lookup_calls_created on public.property_lookup_calls(created_at desc);
alter table public.property_lookup_calls enable row level security;
revoke all on public.property_lookup_calls from anon, authenticated;

-- Per-space quota for lookups uses usage_events like analyses do.
alter table public.usage_events drop constraint if exists usage_events_kind_check;
alter table public.usage_events add constraint usage_events_kind_check check (kind in ('om_parse','doc_generate','alert_parse','analysis','property_lookup'));
create or replace function public.record_usage(usage_kind text, t_in int, t_out int) returns void
language plpgsql security definer set search_path = public as $$
begin
  if usage_kind not in ('analysis','om_parse','doc_generate','alert_parse','property_lookup') then raise exception 'bad kind'; end if;
  insert into public.usage_events(org_id, user_id, kind, tokens_in, tokens_out) values (public.auth_org_id(), auth.uid(), usage_kind, greatest(t_in, 0), greatest(t_out, 0));
end $$;

-- The property record an analysis used, shown on the deal page.
alter table public.analyses add column if not exists records jsonb;

-- ===================== 20261105000006_plan_tiers.sql =====================
-- Plan ladder update: buy box rules move down to Firm; team-space count follows the plan
-- (Firm 1, Fund 3). Seats per team are unchanged (Firm 5, Fund 15).

create or replace function public.create_team(team_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare new_org uuid; me record; plan text := public.user_plan(auth.uid()); allowed int;
begin
  if public.plan_rank(plan) < 2 then
    raise exception 'Team spaces come with Firm and Fund.' using errcode = '42501';
  end if;
  allowed := case plan when 'fund' then 3 else 1 end;
  if (select count(*) from public.orgs where owner_user_id = auth.uid() and kind = 'team') >= allowed then
    raise exception '% includes % team space%.%', initcap(plan), allowed, case when allowed = 1 then '' else 's' end,
      case when plan = 'fund' then ' Delete one to create another.' else ' Fund includes 3.' end using errcode = 'P0001';
  end if;
  select * into me from public.profiles where user_id = auth.uid();
  insert into public.orgs(name, kind, owner_user_id, contact_name, contact_email)
    values (coalesce(nullif(trim(team_name), ''), 'Team'), 'team', auth.uid(), me.full_name, me.email) returning id into new_org;
  insert into public.org_members(org_id, user_id, role) values (new_org, auth.uid(), 'owner');
  insert into public.subscriptions(org_id) values (new_org);
  return new_org;
end $$;

create or replace function public.set_buy_box(rules jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.plan_rank(public.space_plan(public.auth_org_id())) < 2 then
    raise exception 'Buy box rules come with Firm and Fund.' using errcode = '42501';
  end if;
  update public.orgs set buy_box = coalesce(rules, '{}') where id = public.auth_org_id();
end $$;

-- Safety: deleting a space must never delete a person's profile. profiles.org_id is only the
-- ACTIVE-space pointer; auth_org_id() already falls back to the personal space when it is null.
alter table public.profiles alter column org_id drop not null;
alter table public.profiles drop constraint if exists profiles_org_id_fkey;
alter table public.profiles add constraint profiles_org_id_fkey foreign key (org_id) references public.orgs(id) on delete set null;

-- ===================== 20261105000007_self_healing_accounts.sql =====================
-- Self-healing accounts. Every signed-in person must have a profile, a personal (private) space,
-- membership in it and a Scout subscription. This migration:
--   1. provision_user(uid): creates whatever is missing for one user (idempotent, server-only).
--   2. handle_new_user: calls it, and can never block a sign-up (errors are swallowed; the app heals later).
--   3. ensure_account(): lets a signed-in user heal their own account on their next page load.
--   4. Backfills everyone who signed up before the setup was run.

create or replace function public.provision_user(uid uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  u record;
  p record;
  new_org uuid;
  inv record;
  display_name text;
begin
  select * into u from auth.users where id = uid;
  if not found then return null; end if;
  select * into p from public.profiles where user_id = uid;
  if found and p.personal_org_id is not null
     and exists (select 1 from public.orgs where id = p.personal_org_id) then
    return p.personal_org_id;
  end if;

  display_name := coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), split_part(u.email, '@', 1), 'My');
  insert into public.orgs(name, kind, owner_user_id, contact_name, contact_email)
    values (display_name || '''s space', 'personal', uid, display_name, coalesce(u.email, ''))
    returning id into new_org;

  if p.user_id is not null then
    update public.profiles set personal_org_id = new_org, org_id = coalesce(org_id, new_org) where user_id = uid;
  else
    insert into public.profiles(user_id, org_id, personal_org_id, full_name, email, role)
      values (uid, new_org, new_org, display_name, coalesce(u.email, ''), 'owner');
  end if;
  insert into public.org_members(org_id, user_id, role) values (new_org, uid, 'owner') on conflict do nothing;
  insert into public.subscriptions(org_id) values (new_org) on conflict do nothing;

  -- Sample data is a nice-to-have; never let it block an account.
  begin
    perform public.seed_org(new_org);
  exception when others then null;
  end;

  -- Pending team invites for this email become memberships (seat limits still apply).
  for inv in select * from public.org_invites where lower(email) = lower(u.email) loop
    delete from public.org_invites where id = inv.id;
    begin
      insert into public.org_members(org_id, user_id, role) values (inv.org_id, uid, 'member') on conflict do nothing;
    exception when others then null;
    end;
  end loop;
  return new_org;
end $$;

revoke all on function public.provision_user(uuid) from public, anon, authenticated;

-- Sign-up trigger: same work, but a failure here must not stop someone creating an account.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.provision_user(new.id);
  exception when others then
    raise warning 'provision_user failed for %: %', new.id, sqlerrm;
  end;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Called by the app when a signed-in user has no account yet. Only ever touches the caller.
create or replace function public.ensure_account() returns uuid
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not signed in.' using errcode = '42501'; end if;
  return public.provision_user(auth.uid());
end $$;
revoke all on function public.ensure_account() from public, anon;
grant execute on function public.ensure_account() to authenticated;

-- Backfill: everyone who signed up before the setup ran.
do $$
declare r record;
begin
  for r in
    select u.id from auth.users u
    left join public.profiles p on p.user_id = u.id
    where p.user_id is null or p.personal_org_id is null
  loop
    perform public.provision_user(r.id);
  end loop;
end $$;

-- ===================== 20261105000008_no_sample_data.sql =====================
-- New accounts start empty: no sample self-storage deals or sample buyers.
-- seed_org() is kept (provision_user() calls it) but does nothing now.
create or replace function public.seed_org(target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  null;
end $$;

-- Optional, run by hand if you want to clear sample rows from existing accounts:
--   delete from public.deals where is_sample;
--   delete from public.buyers where email like '%.example';   -- sample buyers all use .example emails
