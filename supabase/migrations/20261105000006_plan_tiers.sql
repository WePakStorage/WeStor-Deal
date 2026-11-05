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
