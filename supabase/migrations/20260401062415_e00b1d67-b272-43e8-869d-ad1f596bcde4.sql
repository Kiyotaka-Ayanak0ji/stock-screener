
CREATE OR REPLACE FUNCTION public.handle_new_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_subscriptions (user_id, plan, status, trial_ends_at)
  VALUES (NEW.id, 'free', 'trial', now() + interval '15 days');
  RETURN NEW;
END;
$function$;

-- Update existing trial users: set trial_ends_at to created_at + 15 days (if still in trial)
UPDATE public.user_subscriptions
SET trial_ends_at = created_at + interval '15 days'
WHERE status = 'trial'
  AND trial_ends_at IS NOT NULL
  AND trial_ends_at > now();
