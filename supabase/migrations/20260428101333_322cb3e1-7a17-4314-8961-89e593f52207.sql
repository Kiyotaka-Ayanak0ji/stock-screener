CREATE OR REPLACE FUNCTION public.enforce_watchlist_quota()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  current_count integer;
  user_plan text;
  user_status text;
  max_allowed integer;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT plan, status INTO user_plan, user_status
  FROM public.user_subscriptions
  WHERE user_id = NEW.user_id
  ORDER BY updated_at DESC
  LIMIT 1;

  IF user_plan IS NULL OR user_status IN ('expired', 'cancelled') THEN
    max_allowed := 1;
  ELSIF user_plan = 'lifetime' THEN
    max_allowed := NULL; -- unlimited (legacy lifetime members)
  ELSIF user_plan IN ('premium_plus', 'premium_plus_monthly', 'premium_plus_yearly') THEN
    max_allowed := 50;
  ELSIF user_plan IN ('premium', 'premium_monthly', 'premium_yearly') THEN
    max_allowed := 20;
  ELSIF user_plan IN ('pro', 'monthly', 'yearly') THEN
    max_allowed := 5;
  ELSE
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
$function$;