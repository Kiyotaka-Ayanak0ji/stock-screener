
CREATE TABLE public.sector_cache (
  ticker TEXT PRIMARY KEY,
  sector TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'screener',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sector_cache ENABLE ROW LEVEL SECURITY;

-- Anyone can read cached sectors
CREATE POLICY "Anyone can read sector cache"
ON public.sector_cache FOR SELECT
TO anon, authenticated
USING (true);

-- Service role and anon (edge functions) can insert/update
CREATE POLICY "Service and anon can insert sector cache"
ON public.sector_cache FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Service and anon can update sector cache"
ON public.sector_cache FOR UPDATE
TO anon, authenticated
USING (true);

CREATE INDEX idx_sector_cache_sector ON public.sector_cache(sector);
