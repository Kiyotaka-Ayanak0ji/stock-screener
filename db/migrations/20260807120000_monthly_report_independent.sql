-- 20260807120000  Independent monthly report preference + migration bookkeeping
--
-- Idempotent, non destructive, safe to re run on any Postgres/Supabase database.
-- Rollback: db/migrations/rollback/20260807120000_down.sql

begin;

-- 1. Migration bookkeeping ----------------------------------------------------
create table if not exists public.schema_migrations (
  version      text primary key,
  description  text not null default '',
  applied_at   timestamptz not null default now()
);

grant all on public.schema_migrations to service_role;
alter table public.schema_migrations enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'schema_migrations'
      and policyname = 'schema_migrations_service_role_only'
  ) then
    create policy "schema_migrations_service_role_only"
      on public.schema_migrations for all
      to service_role using (true) with check (true);
  end if;
end $$;

-- Automatic detection of the previous schema version: record the versions that
-- an existing database already satisfies, so upgrades resume at the right point.
insert into public.schema_migrations (version, description)
select v, 'backfilled (pre-existing schema)'
from (values
  ('00000000000000', 'production baseline'),
  ('20260806014838', 'monthly report opt-in column')
) as t(v)
on conflict (version) do nothing;

-- 2. Independent monthly report preference ------------------------------------
alter table public.profiles
  add column if not exists monthly_report_opt_in boolean not null default true;

update public.profiles
   set monthly_report_opt_in = true
 where monthly_report_opt_in is null;

-- Historic behaviour coupled the monthly report to email_opt_in. Users who had
-- email switched off never received it, so their effective state is preserved.
-- Guarded by the bookkeeping table: runs exactly once, never on a re run.
do $$
begin
  if not exists (select 1 from public.schema_migrations where version = '20260807120000') then
    update public.profiles
       set monthly_report_opt_in = false
     where email_opt_in is false;
  end if;
end $$;

comment on column public.profiles.monthly_report_opt_in is
  'Independent switch for the monthly activity report. Not affected by email_opt_in.';

insert into public.schema_migrations (version, description)
values ('20260807120000', 'independent monthly report preference + schema_migrations')
on conflict (version) do nothing;

commit;
