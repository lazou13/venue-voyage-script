
-- 1. Add columns
ALTER TABLE public.medina_pois
  ADD COLUMN IF NOT EXISTS is_start_hub boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hub_theme text;

-- 2. Hub must have coordinates
ALTER TABLE public.medina_pois
  ADD CONSTRAINT hub_requires_coordinates
  CHECK (is_start_hub = false OR (lat IS NOT NULL AND lng IS NOT NULL));

-- 3. One active hub per theme
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_hub_per_theme
  ON public.medina_pois (hub_theme)
  WHERE is_start_hub = true AND is_active = true;
