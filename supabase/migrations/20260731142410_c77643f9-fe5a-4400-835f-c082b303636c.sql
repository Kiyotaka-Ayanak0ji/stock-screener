CREATE TABLE public.user_favourites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  ticker text NOT NULL,
  name text,
  exchange text NOT NULL DEFAULT 'NSE',
  is_index boolean NOT NULL DEFAULT false,
  yahoo_symbol text,
  screener_code text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, ticker)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_favourites TO authenticated;
GRANT ALL ON public.user_favourites TO service_role;

ALTER TABLE public.user_favourites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own favourites"
  ON public.user_favourites FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own favourites"
  ON public.user_favourites FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own favourites"
  ON public.user_favourites FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favourites"
  ON public.user_favourites FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_user_favourites_user_id ON public.user_favourites (user_id);

CREATE TRIGGER update_user_favourites_updated_at
  BEFORE UPDATE ON public.user_favourites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;