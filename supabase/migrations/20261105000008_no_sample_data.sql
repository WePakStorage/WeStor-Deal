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
