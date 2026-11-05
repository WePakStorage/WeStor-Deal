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
