
-- BLOC 1: real_category column on medina_pois
ALTER TABLE public.medina_pois
  ADD COLUMN IF NOT EXISTS real_category text;

-- Backfill: initialise real_category avec la valeur actuelle de category (lecture seule sur category, pas de modif)
UPDATE public.medina_pois
SET real_category = category
WHERE real_category IS NULL;

-- Index simple pour filtrage UI
CREATE INDEX IF NOT EXISTS idx_medina_pois_real_category
  ON public.medina_pois (real_category);

-- BLOC 2: vue calculée v_poi_qrp_readiness
CREATE OR REPLACE VIEW public.v_poi_qrp_readiness AS
WITH base AS (
  SELECT
    p.id AS poi_id,
    p.name,
    p.real_category,
    p.status,
    p.is_active,
    p.history_context,
    p.local_anecdote_fr,
    p.audio_url_fr,
    p.audio_url_en,
    COALESCE(
      (SELECT array_agg(value::text ORDER BY value::text)
         FROM jsonb_array_elements_text(
           CASE jsonb_typeof(p.metadata->'visit_families')
             WHEN 'array' THEN p.metadata->'visit_families'
             ELSE '[]'::jsonb
           END
         ) AS value),
      ARRAY[]::text[]
    ) AS visit_families,
    CASE jsonb_typeof(p.metadata->'tier_by_family')
      WHEN 'object' THEN p.metadata->'tier_by_family'
      ELSE '{}'::jsonb
    END AS tier_by_family_obj
  FROM public.medina_pois p
),
ready_calc AS (
  SELECT
    b.*,
    -- Pour chaque famille déclarée, calcule ready + gaps en fonction du tier
    (
      SELECT jsonb_object_agg(
        family,
        CASE
          WHEN b.status = 'validated'
           AND b.is_active = true
           AND COALESCE(b.real_category, '') <> 'generic'
           AND COALESCE(b.tier_by_family_obj->>family, '') <> ''
           AND CASE b.tier_by_family_obj->>family
             WHEN 'premium' THEN
               (b.history_context IS NOT NULL AND length(trim(b.history_context)) > 0)
               AND (b.local_anecdote_fr IS NOT NULL AND length(trim(b.local_anecdote_fr)) > 0)
               AND (b.audio_url_fr IS NOT NULL AND length(trim(b.audio_url_fr)) > 0)
               AND (b.audio_url_en IS NOT NULL AND length(trim(b.audio_url_en)) > 0)
             WHEN 'standard' THEN
               (b.history_context IS NOT NULL AND length(trim(b.history_context)) > 0)
               AND (b.audio_url_fr IS NOT NULL AND length(trim(b.audio_url_fr)) > 0)
             WHEN 'mention' THEN true
             ELSE false
           END
          THEN true ELSE false
        END
      )
      FROM unnest(b.visit_families) AS family
    ) AS ready_by_family,
    (
      SELECT jsonb_object_agg(
        family,
        CASE b.tier_by_family_obj->>family
          WHEN 'premium' THEN (
            ARRAY[]::text[]
            || CASE WHEN b.status <> 'validated' THEN ARRAY['status_not_validated'] ELSE ARRAY[]::text[] END
            || CASE WHEN b.is_active = false THEN ARRAY['inactive'] ELSE ARRAY[]::text[] END
            || CASE WHEN COALESCE(b.real_category,'') = 'generic' THEN ARRAY['real_category_generic'] ELSE ARRAY[]::text[] END
            || CASE WHEN b.history_context IS NULL OR length(trim(b.history_context)) = 0 THEN ARRAY['history_context'] ELSE ARRAY[]::text[] END
            || CASE WHEN b.local_anecdote_fr IS NULL OR length(trim(b.local_anecdote_fr)) = 0 THEN ARRAY['local_anecdote_fr'] ELSE ARRAY[]::text[] END
            || CASE WHEN b.audio_url_fr IS NULL OR length(trim(b.audio_url_fr)) = 0 THEN ARRAY['audio_url_fr'] ELSE ARRAY[]::text[] END
            || CASE WHEN b.audio_url_en IS NULL OR length(trim(b.audio_url_en)) = 0 THEN ARRAY['audio_url_en'] ELSE ARRAY[]::text[] END
          )
          WHEN 'standard' THEN (
            ARRAY[]::text[]
            || CASE WHEN b.status <> 'validated' THEN ARRAY['status_not_validated'] ELSE ARRAY[]::text[] END
            || CASE WHEN b.is_active = false THEN ARRAY['inactive'] ELSE ARRAY[]::text[] END
            || CASE WHEN COALESCE(b.real_category,'') = 'generic' THEN ARRAY['real_category_generic'] ELSE ARRAY[]::text[] END
            || CASE WHEN b.history_context IS NULL OR length(trim(b.history_context)) = 0 THEN ARRAY['history_context'] ELSE ARRAY[]::text[] END
            || CASE WHEN b.audio_url_fr IS NULL OR length(trim(b.audio_url_fr)) = 0 THEN ARRAY['audio_url_fr'] ELSE ARRAY[]::text[] END
          )
          WHEN 'mention' THEN (
            ARRAY[]::text[]
            || CASE WHEN b.status <> 'validated' THEN ARRAY['status_not_validated'] ELSE ARRAY[]::text[] END
            || CASE WHEN b.is_active = false THEN ARRAY['inactive'] ELSE ARRAY[]::text[] END
            || CASE WHEN COALESCE(b.real_category,'') = 'generic' THEN ARRAY['real_category_generic'] ELSE ARRAY[]::text[] END
          )
          ELSE ARRAY['no_tier_assigned']::text[]
        END
      )
      FROM unnest(b.visit_families) AS family
    ) AS enrichment_gaps_by_family
  FROM base b
)
SELECT
  poi_id,
  name,
  real_category,
  visit_families,
  tier_by_family_obj AS tier_by_family,
  COALESCE(ready_by_family, '{}'::jsonb) AS ready_by_family,
  COALESCE(enrichment_gaps_by_family, '{}'::jsonb) AS enrichment_gaps_by_family
FROM ready_calc;

-- Sécurité : la vue hérite des permissions des tables sous-jacentes (medina_pois RLS admin)
COMMENT ON VIEW public.v_poi_qrp_readiness IS
  'Lecture seule. Calcule ready_by_family et enrichment_gaps_by_family à partir de real_category, metadata.visit_families et metadata.tier_by_family. Ne stocke rien.';
