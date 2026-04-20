-- 1. Ajout colonne is_main_visit
ALTER TABLE public.medina_pois
ADD COLUMN IF NOT EXISTS is_main_visit boolean NOT NULL DEFAULT false;

-- 2. Index pour filtrage rapide
CREATE INDEX IF NOT EXISTS idx_medina_pois_is_main_visit
ON public.medina_pois (is_main_visit)
WHERE is_main_visit = true;

-- 3. Backfill : promouvoir les POIs majeurs existants
UPDATE public.medina_pois
SET is_main_visit = true
WHERE is_active = true
  AND (
    is_start_hub = true
    OR (
      category = ANY (ARRAY['monument','museum','mosque','medersa','palace','historic_site','garden','fountain','gate_bab'])
      AND COALESCE(poi_quality_score, 0) >= 6
    )
  );