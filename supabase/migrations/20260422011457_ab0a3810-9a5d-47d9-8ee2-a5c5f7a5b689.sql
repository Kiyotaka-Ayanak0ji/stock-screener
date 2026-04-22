
-- Master universe of all known Indian stock tickers
CREATE TABLE IF NOT EXISTS public.stock_universe (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  exchange TEXT NOT NULL CHECK (exchange IN ('NSE','BSE')),
  segment TEXT NOT NULL DEFAULT 'MAIN' CHECK (segment IN ('MAIN','SME')),
  name TEXT,
  bse_code TEXT,
  last_seeded_at TIMESTAMPTZ,
  last_status TEXT NOT NULL DEFAULT 'pending' CHECK (last_status IN ('pending','ok','failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticker, exchange)
);

CREATE INDEX IF NOT EXISTS idx_stock_universe_seed
  ON public.stock_universe (last_seeded_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS idx_stock_universe_segment
  ON public.stock_universe (segment);

ALTER TABLE public.stock_universe ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read stock universe"
  ON public.stock_universe FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can insert universe"
  ON public.stock_universe FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update universe"
  ON public.stock_universe FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can delete universe"
  ON public.stock_universe FOR DELETE
  USING (auth.role() = 'service_role');

CREATE TRIGGER trg_stock_universe_updated_at
  BEFORE UPDATE ON public.stock_universe
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Single-row job progress tracker
CREATE TABLE IF NOT EXISTS public.seed_job_progress (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  cycle_started_at TIMESTAMPTZ,
  last_chunk_at TIMESTAMPTZ,
  total INTEGER NOT NULL DEFAULT 0,
  processed INTEGER NOT NULL DEFAULT 0,
  succeeded INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'idle' CHECK (status IN ('idle','running','paused')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.seed_job_progress (id) VALUES (1)
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.seed_job_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read seed progress"
  ON public.seed_job_progress FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Service role can manage seed progress"
  ON public.seed_job_progress FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER trg_seed_job_progress_updated_at
  BEFORE UPDATE ON public.seed_job_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
