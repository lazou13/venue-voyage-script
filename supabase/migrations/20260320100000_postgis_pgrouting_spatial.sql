-- ============================================================
-- MIGRATION: PostGIS + pgRouting + Spatial upgrade
-- Objectif: passer de lat/lng double precision à geometry(Point, 4326)
--           + graphe piéton pour routage réel dans la médina
-- ============================================================

-- === EXTENSIONS ===
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgrouting CASCADE;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PART 1: Upgrade medina_pois avec colonne géométrique
-- ============================================================

-- Ajouter la colonne geom si elle n'existe pas
ALTER TABLE public.medina_pois
  ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- Populer geom depuis lat/lng existants
UPDATE public.medina_pois
SET geom = ST_SetSRID(ST_MakePoint(lng, lat), 4326)
WHERE lat IS NOT NULL AND lng IS NOT NULL AND geom IS NULL;

-- Trigger pour maintenir geom synchronisé automatiquement
CREATE OR REPLACE FUNCTION public.sync_medina_poi_geom()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.lat IS NOT NULL AND NEW.lng IS NOT NULL THEN
    NEW.geom := ST_SetSRID(ST_MakePoint(NEW.lng, NEW.lat), 4326);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_medina_poi_geom ON public.medina_pois;
CREATE TRIGGER trg_sync_medina_poi_geom
  BEFORE INSERT OR UPDATE OF lat, lng ON public.medina_pois
  FOR EACH ROW EXECUTE FUNCTION public.sync_medina_poi_geom();

-- Index spatial GIST sur geom
CREATE INDEX IF NOT EXISTS idx_medina_pois_geom ON public.medina_pois USING GIST (geom);

-- ============================================================
-- PART 2: Colonnes enrichissement multilingue + Wikidata
-- ============================================================

ALTER TABLE public.medina_pois
  ADD COLUMN IF NOT EXISTS name_ar       text,
  ADD COLUMN IF NOT EXISTS name_fr       text,
  ADD COLUMN IF NOT EXISTS name_en       text,
  ADD COLUMN IF NOT EXISTS wikidata_id   text,
  ADD COLUMN IF NOT EXISTS osm_id        text,
  ADD COLUMN IF NOT EXISTS foursquare_id text,
  ADD COLUMN IF NOT EXISTS street_type   text CHECK (street_type IN (
    'derb','covered_passage','main_street','alley','steps',
    'plaza','tunnel','pedestrian_street','souk_street','boulevard','other'
  )),
  ADD COLUMN IF NOT EXISTS nearest_node_id bigint,
  ADD COLUMN IF NOT EXISTS data_sources  text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS terrain_validated boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS terrain_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS photo_spot_score numeric(3,2) DEFAULT 0;

-- Index sur wikidata_id et osm_id pour déduplication
CREATE INDEX IF NOT EXISTS idx_medina_pois_wikidata ON public.medina_pois (wikidata_id) WHERE wikidata_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_medina_pois_osm ON public.medina_pois (osm_id) WHERE osm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_medina_pois_terrain ON public.medina_pois (terrain_validated) WHERE terrain_validated = true;

-- ============================================================
-- PART 3: Tables graphe piéton (pgRouting)
-- ============================================================

-- Table des nœuds du graphe
CREATE TABLE IF NOT EXISTS public.street_nodes (
  id             bigserial PRIMARY KEY,
  geom           geometry(Point, 4326) NOT NULL,
  osm_node_id    bigint UNIQUE,
  is_intersection boolean DEFAULT false,
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_street_nodes_geom ON public.street_nodes USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_street_nodes_osm ON public.street_nodes (osm_node_id) WHERE osm_node_id IS NOT NULL;

-- Table des segments (arêtes du graphe)
CREATE TABLE IF NOT EXISTS public.streets (
  id             bigserial PRIMARY KEY,
  osm_id         bigint,
  name           text,
  name_ar        text,
  name_fr        text,
  geom           geometry(LineString, 4326) NOT NULL,
  street_type    text DEFAULT 'other' CHECK (street_type IN (
    'derb','covered_passage','main_street','alley','steps',
    'plaza','tunnel','pedestrian_street','souk_street','boulevard','other'
  )),
  length_m       double precision GENERATED ALWAYS AS (
                   ST_Length(geom::geography)
                 ) STORED,
  is_covered     boolean DEFAULT false,
  surface        text,
  source         bigint REFERENCES public.street_nodes(id),
  target         bigint REFERENCES public.street_nodes(id),
  -- Coûts pgRouting : temps en secondes à vitesse variable selon type
  cost           double precision GENERATED ALWAYS AS (
                   ST_Length(geom::geography) / 0.83 *
                   CASE street_type
                     WHEN 'steps'            THEN 2.0
                     WHEN 'derb'             THEN 1.3
                     WHEN 'covered_passage'  THEN 1.1
                     WHEN 'souk_street'      THEN 1.5
                     WHEN 'main_street'      THEN 0.9
                     ELSE 1.0
                   END
                 ) STORED,
  reverse_cost   double precision GENERATED ALWAYS AS (
                   ST_Length(geom::geography) / 0.83 *
                   CASE street_type
                     WHEN 'steps'            THEN 2.0
                     WHEN 'derb'             THEN 1.3
                     WHEN 'covered_passage'  THEN 1.1
                     WHEN 'souk_street'      THEN 1.5
                     WHEN 'main_street'      THEN 0.9
                     ELSE 1.0
                   END
                 ) STORED,
  metadata       jsonb DEFAULT '{}',
  created_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_streets_geom   ON public.streets USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_streets_source ON public.streets (source);
CREATE INDEX IF NOT EXISTS idx_streets_target ON public.streets (target);
CREATE INDEX IF NOT EXISTS idx_streets_osm    ON public.streets (osm_id) WHERE osm_id IS NOT NULL;

-- ============================================================
-- PART 4: Vue de coût personnalisée pour la médina (alias pgRouting)
-- ============================================================

CREATE OR REPLACE VIEW public.streets_walking_cost AS
SELECT
  id,
  source,
  target,
  cost,
  reverse_cost,
  length_m,
  street_type,
  name,
  geom
FROM public.streets
WHERE source IS NOT NULL AND target IS NOT NULL;

-- ============================================================
-- PART 5: Fonctions utilitaires spatiales
-- ============================================================

-- POIs proches d'un point (utilise index GIST)
CREATE OR REPLACE FUNCTION public.nearby_pois(
  p_lat        double precision,
  p_lng        double precision,
  p_radius_m   double precision DEFAULT 800,
  p_category   text DEFAULT NULL,
  p_limit      int DEFAULT 50
)
RETURNS TABLE (
  id           uuid,
  name         text,
  name_fr      text,
  name_ar      text,
  category     text,
  lat          double precision,
  lng          double precision,
  distance_m   double precision,
  poi_quality_score numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    mp.id,
    mp.name,
    mp.name_fr,
    mp.name_ar,
    COALESCE(mp.category_ai, mp.category, 'other') AS category,
    mp.lat,
    mp.lng,
    ST_Distance(mp.geom::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) AS distance_m,
    mp.poi_quality_score
  FROM public.medina_pois mp
  WHERE
    mp.is_active = true
    AND mp.geom IS NOT NULL
    AND ST_DWithin(
      mp.geom::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography,
      p_radius_m
    )
    AND (p_category IS NULL OR mp.category_ai = p_category OR mp.category = p_category)
    AND mp.status NOT IN ('filtered', 'merged')
  ORDER BY distance_m
  LIMIT p_limit;
$$;

-- Lier chaque POI à son nœud de graphe le plus proche
CREATE OR REPLACE FUNCTION public.link_pois_to_nearest_nodes()
RETURNS integer
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  updated_count integer;
BEGIN
  UPDATE public.medina_pois mp
  SET nearest_node_id = (
    SELECT sn.id
    FROM public.street_nodes sn
    ORDER BY sn.geom <-> mp.geom
    LIMIT 1
  )
  WHERE mp.geom IS NOT NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

-- ============================================================
-- PART 6: Table import_batches (traçabilité des imports OSM/Wikidata)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.import_batches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source       text NOT NULL CHECK (source IN ('osm', 'wikidata', 'google', 'foursquare', 'terrain')),
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  pois_added   integer DEFAULT 0,
  pois_updated integer DEFAULT 0,
  pois_merged  integer DEFAULT 0,
  bbox         jsonb,
  params       jsonb DEFAULT '{}',
  error_msg    text,
  started_at   timestamptz,
  completed_at timestamptz,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage import_batches"
  ON public.import_batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- RLS pour street_nodes et streets (lecture publique, écriture admin)
ALTER TABLE public.street_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read street_nodes"
  ON public.street_nodes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins write street_nodes"
  ON public.street_nodes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Public read streets"
  ON public.streets FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins write streets"
  ON public.streets FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
