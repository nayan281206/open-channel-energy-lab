-- The privileged server key maps to service_role. Grant read access only.
-- This does not grant regular authenticated or anonymous users cross-user access.
begin;
grant usage on schema public to service_role;
grant select on public.user_profiles, public.simulation_runs to service_role;
commit;
