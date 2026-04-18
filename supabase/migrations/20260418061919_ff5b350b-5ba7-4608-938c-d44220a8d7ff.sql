-- Stock price history cache for sparkline mini-charts (multi-day trends)
CREATE TABLE public.stock_price_history (
  id BIGSERIAL PRIMARY KEY,
  ticker TEXT NOT NULL,
  exchange TEXT NOT NULL,
  price NUMERIC NOT NULL,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_price_history_ticker_recorded
  ON public.stock_price_history (ticker, exchange, recorded_at DESC);

ALTER TABLE public.stock_price_history ENABLE ROW LEVEL SECURITY;

-- Anyone can read price history (public market data, same model as cached_stock_prices)
CREATE POLICY "Anyone can read price history"
  ON public.stock_price_history
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only the service role (via the upsert edge function) can write history
CREATE POLICY "Service role can insert price history"
  ON public.stock_price_history
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can delete old price history"
  ON public.stock_price_history
  FOR DELETE
  TO public
  USING (auth.role() = 'service_role');