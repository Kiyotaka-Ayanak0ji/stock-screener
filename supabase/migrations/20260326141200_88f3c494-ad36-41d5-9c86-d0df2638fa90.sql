
CREATE TABLE public.portfolio_holdings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ticker TEXT NOT NULL,
  exchange TEXT NOT NULL DEFAULT 'NSE',
  buy_price NUMERIC NOT NULL,
  quantity NUMERIC NOT NULL,
  buy_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sector TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.portfolio_holdings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own holdings"
  ON public.portfolio_holdings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own holdings"
  ON public.portfolio_holdings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own holdings"
  ON public.portfolio_holdings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own holdings"
  ON public.portfolio_holdings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
