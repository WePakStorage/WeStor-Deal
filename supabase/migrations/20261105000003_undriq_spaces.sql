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
