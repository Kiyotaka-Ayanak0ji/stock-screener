-- Rollback for 20260807120000.
--
-- Restores the pre upgrade behaviour without destroying data: the preference
-- column is intentionally kept (dropping it would delete user preferences).
-- Only the bookkeeping row is removed, so the migration can be re applied.

begin;

delete from public.schema_migrations where version = '20260807120000';

commit;
