ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS auto_refresh_on_load boolean NOT NULL DEFAULT false;