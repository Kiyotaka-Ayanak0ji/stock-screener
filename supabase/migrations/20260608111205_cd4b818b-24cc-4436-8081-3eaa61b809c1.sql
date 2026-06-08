
-- 1) Revoke EXECUTE on internal SECURITY DEFINER functions from anon/authenticated.
-- These are only intended for server-side (service_role) and trigger use.
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_subscription() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_watchlist_quota() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_email(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) TO service_role;

-- Note: public.has_role(uuid, app_role) intentionally retains EXECUTE for authenticated
-- because RLS policies across the schema invoke it to perform role checks.

-- 2) Allow users to read their own reviews regardless of approval status
DROP POLICY IF EXISTS "Users can read their own reviews" ON public.app_reviews;
CREATE POLICY "Users can read their own reviews"
ON public.app_reviews
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3) Restrict seed_job_progress public read; admins only via app, service_role for backend
DROP POLICY IF EXISTS "Anyone can read seed progress" ON public.seed_job_progress;
DROP POLICY IF EXISTS "Admins can read seed progress" ON public.seed_job_progress;
CREATE POLICY "Admins can read seed progress"
ON public.seed_job_progress
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
