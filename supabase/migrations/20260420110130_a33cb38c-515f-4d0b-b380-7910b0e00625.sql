
-- 1. Remove the user INSERT policy on user_subscriptions to prevent
--    authenticated users from self-issuing paid subscription rows.
--    All writes must go through service_role (Razorpay verify edge functions).
DROP POLICY IF EXISTS "Users can insert their own subscription" ON public.user_subscriptions;

-- 2. Restrict sector_cache writes to service_role only. The sector-lookup
--    edge function uses the service role key, so it remains fully functional.
DROP POLICY IF EXISTS "Service and anon can insert sector cache" ON public.sector_cache;
DROP POLICY IF EXISTS "Service and anon can update sector cache" ON public.sector_cache;

CREATE POLICY "Service role can insert sector cache"
  ON public.sector_cache
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update sector cache"
  ON public.sector_cache
  FOR UPDATE
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 3. Server-side enforcement of per-plan watchlist quotas.
--    Mirrors PLAN_LIMITS in src/lib/planFeatures.ts:
--      guest/free  -> 1 watchlist
--      pro         -> 5
--      premium / premium_monthly -> 20
--      premium_plus / lifetime / yearly (legacy) -> unlimited
CREATE OR REPLACE FUNCTION public.enforce_watchlist_quota()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_count integer;
  user_plan text;
  user_status text;
  max_allowed integer;
BEGIN
  -- Service role bypasses the check (admin/edge function inserts).
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT plan, status INTO user_plan, user_status
  FROM public.user_subscriptions
  WHERE user_id = NEW.user_id
  ORDER BY updated_at DESC
  LIMIT 1;

  -- Determine allowed quota based on plan + status.
  -- Treat expired/cancelled subscriptions as free tier.
  IF user_plan IS NULL OR user_status IN ('expired', 'cancelled') THEN
    max_allowed := 1;
  ELSIF user_plan IN ('premium_plus', 'lifetime') THEN
    max_allowed := NULL; -- unlimited
  ELSIF user_plan IN ('premium', 'premium_monthly', 'premium_yearly') THEN
    max_allowed := 20;
  ELSIF user_plan IN ('pro', 'monthly', 'yearly') THEN
    max_allowed := 5;
  ELSE
    -- 'free' or unknown plan
    max_allowed := 1;
  END IF;

  IF max_allowed IS NOT NULL THEN
    SELECT COUNT(*) INTO current_count
    FROM public.user_watchlists
    WHERE user_id = NEW.user_id;

    IF current_count >= max_allowed THEN
      RAISE EXCEPTION 'Watchlist quota exceeded for your plan (max %).', max_allowed
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_watchlist_quota_trigger ON public.user_watchlists;
CREATE TRIGGER enforce_watchlist_quota_trigger
  BEFORE INSERT ON public.user_watchlists
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_watchlist_quota();
