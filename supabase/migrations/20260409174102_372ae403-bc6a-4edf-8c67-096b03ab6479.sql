-- API Keys table
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  app_name TEXT NOT NULL,
  app_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  requests_count INTEGER DEFAULT 0,
  rate_limit INTEGER DEFAULT 1000,
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_api_keys_key ON public.api_keys(key);
CREATE INDEX idx_api_keys_active ON public.api_keys(is_active) WHERE is_active = true;

-- API Usage table (hourly buckets for rate limiting)
CREATE TABLE public.api_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE CASCADE,
  request_count INTEGER DEFAULT 0,
  window_start TIMESTAMPTZ DEFAULT date_trunc('hour', NOW()),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_api_usage_key_window ON public.api_usage(api_key_id, window_start DESC);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies: admin only
CREATE POLICY "Admins can manage api_keys"
ON public.api_keys FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage api_usage"
ON public.api_usage FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Seed initial API keys
INSERT INTO public.api_keys (key, app_name, app_id, rate_limit) VALUES
  ('qr_live_questride_' || substring(md5(random()::text) from 1 for 24), 'Questride B2C/B2B', 'cflyexnquulsjpzbbayh', 5000),
  ('qr_live_pro_' || substring(md5(random()::text) from 1 for 24), 'QUEST RIDES PRO', 'xaccaoedtbwywjotqhih', 10000);