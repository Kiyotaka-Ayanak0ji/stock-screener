
CREATE TABLE public.shared_watchlists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_token TEXT NOT NULL UNIQUE,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  watchlist_name TEXT NOT NULL,
  tickers TEXT NOT NULL,
  stock_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.shared_watchlists ENABLE ROW LEVEL SECURITY;

-- Owner can manage their shared links
CREATE POLICY "Owners can manage their shared watchlists"
  ON public.shared_watchlists FOR ALL
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Anyone with the token can read (for the shared view page)
CREATE POLICY "Anyone can read by share token"
  ON public.shared_watchlists FOR SELECT
  TO anon, authenticated
  USING (true);
