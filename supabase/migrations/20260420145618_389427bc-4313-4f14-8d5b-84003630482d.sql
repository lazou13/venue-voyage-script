-- 1) Garde-fou anti-doublon : un seul POI principal actif par nom normalisé
CREATE UNIQUE INDEX IF NOT EXISTS uniq_main_visit_active_name
  ON public.medina_pois (lower(coalesce(nullif(trim(name_fr),''), name)))
  WHERE is_main_visit = true AND is_active = true;