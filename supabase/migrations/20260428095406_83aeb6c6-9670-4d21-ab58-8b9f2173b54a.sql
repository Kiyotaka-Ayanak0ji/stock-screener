-- One-time reset of stock chart history.
-- Removes accumulated noisy/legacy points so the chart restarts from a clean slate.
TRUNCATE TABLE public.stock_price_history RESTART IDENTITY;