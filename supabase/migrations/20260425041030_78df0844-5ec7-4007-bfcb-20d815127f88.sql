-- App-wide settings (admin-managed key/value)
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read app settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert app settings"
  ON public.app_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update app settings"
  ON public.app_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Service role bypass for edge functions (needs to read the toggle without a JWT)
CREATE POLICY "Service role can manage app settings"
  ON public.app_settings FOR ALL
  TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Seed the verification debug toggle
INSERT INTO public.app_settings (key, value)
VALUES ('verification_debug_enabled', 'false'::jsonb);

-- Per-verification debug log
CREATE TABLE public.verification_debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticker TEXT NOT NULL,
  exchange TEXT NOT NULL,
  primary_source TEXT,           -- screener | google | bse | none
  sources_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Per-source field availability map, e.g.
  -- { "screener": { "filled": ["price","pe"], "missing": ["volume"] }, "bse": {...} }
  source_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Final fields written to the cache (true = present and non-zero)
  final_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Final numeric values for inspection
  final_values JSONB NOT NULL DEFAULT '{}'::jsonb,
  bse_code TEXT,
  duration_ms INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_verification_debug_logs_created_at
  ON public.verification_debug_logs (created_at DESC);
CREATE INDEX idx_verification_debug_logs_ticker
  ON public.verification_debug_logs (ticker);

ALTER TABLE public.verification_debug_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read verification debug logs"
  ON public.verification_debug_logs FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete verification debug logs"
  ON public.verification_debug_logs FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can insert verification debug logs"
  ON public.verification_debug_logs FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can read verification debug logs"
  ON public.verification_debug_logs FOR SELECT
  TO public
  USING (auth.role() = 'service_role');