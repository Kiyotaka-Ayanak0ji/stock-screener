
CREATE TABLE public.cached_stock_prices (
  ticker TEXT NOT NULL,
  exchange TEXT NOT NULL,
  price NUMERIC NOT NULL,
  previous_close NUMERIC NOT NULL,
  change NUMERIC NOT NULL,
  change_percent NUMERIC NOT NULL,
  high NUMERIC NOT NULL,
  low NUMERIC NOT NULL,
  open_price NUMERIC NOT NULL,
  volume BIGINT NOT NULL,
  market_cap NUMERIC NOT NULL,
  name TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  PRIMARY KEY (ticker, exchange)
);

ALTER TABLE public.cached_stock_prices ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read cached prices
CREATE POLICY "Anyone can read cached prices"
  ON public.cached_stock_prices
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Allow authenticated users to upsert cached prices
CREATE POLICY "Authenticated users can upsert cached prices"
  ON public.cached_stock_prices
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update cached prices"
  ON public.cached_stock_prices
  FOR UPDATE
  TO authenticated
  USING (true);

-- Allow anon users to upsert cached prices (for guest mode)
CREATE POLICY "Anon users can upsert cached prices"
  ON public.cached_stock_prices
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anon users can update cached prices"
  ON public.cached_stock_prices
  FOR UPDATE
  TO anon
  USING (true);
