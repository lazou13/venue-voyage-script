ALTER TABLE public.medina_pois
  ADD COLUMN IF NOT EXISTS video_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS fun_facts_bilingual JSONB NOT NULL DEFAULT '[]'::jsonb;