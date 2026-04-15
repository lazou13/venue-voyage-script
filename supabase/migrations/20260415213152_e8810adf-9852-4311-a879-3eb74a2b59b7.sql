ALTER TABLE public.medina_pois
  ADD COLUMN IF NOT EXISTS audio_url_fr text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS audio_url_en text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS audio_url_ar text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS anecdote_audio_url_fr text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS anecdote_audio_url_en text DEFAULT NULL;