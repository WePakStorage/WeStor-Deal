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
