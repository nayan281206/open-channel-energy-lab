begin;
create table public.user_profiles (
  clerk_user_id text primary key default (auth.jwt()->>'sub'),
  email text,
  name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.simulation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id text not null default (auth.jwt()->>'sub') references public.user_profiles(clerk_user_id) on delete cascade,
  request_id uuid not null,
  channel_shape text not null check (channel_shape in ('rectangular','triangular','trapezoidal','circular')),
  parameters jsonb not null check (jsonb_typeof(parameters) = 'object'),
  solver_tolerance double precision not null check (solver_tolerance in (1e-6,1e-8,1e-10)),
  froude double precision not null check (froude >= 0 and froude < 'Infinity'::float8),
  critical_depth double precision not null check (critical_depth > 0 and critical_depth < 'Infinity'::float8),
  specific_energy double precision not null check (specific_energy > 0 and specific_energy < 'Infinity'::float8),
  flow_regime text not null check (flow_regime in ('SUBCRITICAL','CRITICAL','SUPERCRITICAL')),
  results jsonb not null check (jsonb_typeof(results) = 'object'),
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);
create index simulation_runs_user_created on public.simulation_runs(user_id, created_at desc);
alter table public.user_profiles enable row level security;
alter table public.simulation_runs enable row level security;
revoke all on public.user_profiles, public.simulation_runs from anon;
grant select, insert, update on public.user_profiles to authenticated;
grant select, insert on public.simulation_runs to authenticated;
create policy profiles_select_self on public.user_profiles for select to authenticated using ((select auth.jwt()->>'sub') = clerk_user_id);
create policy profiles_insert_self on public.user_profiles for insert to authenticated with check ((select auth.jwt()->>'sub') = clerk_user_id);
create policy profiles_update_self on public.user_profiles for update to authenticated using ((select auth.jwt()->>'sub') = clerk_user_id) with check ((select auth.jwt()->>'sub') = clerk_user_id);
create policy runs_select_self on public.simulation_runs for select to authenticated using ((select auth.jwt()->>'sub') = user_id);
create policy runs_insert_self on public.simulation_runs for insert to authenticated with check ((select auth.jwt()->>'sub') = user_id);
commit;
