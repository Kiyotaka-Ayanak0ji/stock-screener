
-- RLS policies on user_roles, app_settings, verification_debug_logs and
-- seed_job_progress call private.has_role() when the querying role is
-- 'authenticated'. Without EXECUTE for authenticated, the policy raises
-- 'permission denied for function' and admins silently lose access.
-- The function is in the `private` schema which is NOT exposed via PostgREST,
-- so this does not reintroduce the earlier public-API SECURITY DEFINER finding.
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;
