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
