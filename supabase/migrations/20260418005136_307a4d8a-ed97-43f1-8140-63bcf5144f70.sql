-- 1. cached_stock_prices: remove anon/authenticated write policies (service role only)
DROP POLICY IF EXISTS "Anon users can update cached prices" ON public.cached_stock_prices;
DROP POLICY IF EXISTS "Anon users can upsert cached prices" ON public.cached_stock_prices;
DROP POLICY IF EXISTS "Authenticated users can update cached prices" ON public.cached_stock_prices;
DROP POLICY IF EXISTS "Authenticated users can upsert cached prices" ON public.cached_stock_prices;

CREATE POLICY "Service role can insert cached prices"
  ON public.cached_stock_prices FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update cached prices"
  ON public.cached_stock_prices FOR UPDATE
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 2. shared_watchlists: drop overly-permissive public SELECT policy
-- Token-scoped reads now go through the get-shared-watchlist edge function (service role).
DROP POLICY IF EXISTS "Anyone can read by share token" ON public.shared_watchlists;

CREATE POLICY "Owners can view their shared watchlists"
  ON public.shared_watchlists FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- 3. user_roles: prevent authenticated users from inserting/updating/deleting their own roles
CREATE POLICY "Only service role can insert user roles"
  ON public.user_roles FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can update user roles"
  ON public.user_roles FOR UPDATE
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Only service role can delete user roles"
  ON public.user_roles FOR DELETE
  TO public
  USING (auth.role() = 'service_role');

-- 4. Storage policies for stock-bucket
CREATE POLICY "Public can read stock-bucket files"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'stock-bucket');

CREATE POLICY "Only service role can upload to stock-bucket"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'stock-bucket' AND auth.role() = 'service_role');

CREATE POLICY "Only service role can update stock-bucket files"
  ON storage.objects FOR UPDATE
  TO public
  USING (bucket_id = 'stock-bucket' AND auth.role() = 'service_role');

CREATE POLICY "Only service role can delete stock-bucket files"
  ON storage.objects FOR DELETE
  TO public
  USING (bucket_id = 'stock-bucket' AND auth.role() = 'service_role');

-- 5. Fix mutable search_path on existing helper functions (security linter warning)
CREATE OR REPLACE FUNCTION public.enqueue_email(queue_name text, payload jsonb)
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $function$ SELECT pgmq.send(queue_name, payload); $function$;

CREATE OR REPLACE FUNCTION public.read_email_batch(queue_name text, batch_size integer, vt integer)
RETURNS TABLE(msg_id bigint, read_ct integer, message jsonb)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $function$ SELECT msg_id, read_ct, message FROM pgmq.read(queue_name, vt, batch_size); $function$;

CREATE OR REPLACE FUNCTION public.move_to_dlq(source_queue text, dlq_name text, message_id bigint, payload jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $function$
DECLARE new_id BIGINT;
BEGIN
  SELECT pgmq.send(dlq_name, payload) INTO new_id;
  PERFORM pgmq.delete(source_queue, message_id);
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_email(queue_name text, message_id bigint)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pgmq
AS $function$ SELECT pgmq.delete(queue_name, message_id); $function$;