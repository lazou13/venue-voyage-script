-- ============================================================
-- MIGRATION: Fonctions RPC pour pgRouting dans Edge Functions
-- ============================================================

-- Trouver les N nœuds les plus proches d'un point (KNN avec index GIST)
CREATE OR REPLACE FUNCTION public.nearby_nodes_knn(
  p_lat   double precision,
  p_lng   double precision,
  p_limit int DEFAULT 1
)
RETURNS TABLE (
  id           bigint,
  distance_m   double precision
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT
    sn.id,
    ST_Distance(
      sn.geom::geography,
      ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
    ) AS distance_m
  FROM public.street_nodes sn
  ORDER BY sn.geom <-> ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)
  LIMIT p_limit;
$$;

-- Matrice de coûts de marche entre N nœuds via pgr_dijkstraCostMatrix
-- Retourne une table (start_vid, end_vid, agg_cost) où agg_cost = secondes
CREATE OR REPLACE FUNCTION public.get_walking_cost_matrix(
  node_ids bigint[]
)
RETURNS TABLE (
  start_vid bigint,
  end_vid   bigint,
  agg_cost  double precision
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  -- Vérifier que pgRouting est disponible et que le graphe est peuplé
  IF (SELECT count(*) FROM public.streets WHERE source IS NOT NULL AND target IS NOT NULL) = 0 THEN
    RETURN; -- Retourner vide → fallback haversine côté Edge Function
  END IF;

  RETURN QUERY
  SELECT r.start_vid, r.end_vid, r.agg_cost
  FROM pgr_dijkstraCostMatrix(
    'SELECT id, source, target, cost, reverse_cost FROM public.streets_walking_cost',
    node_ids,
    directed := false
  ) AS r;
END;
$$;

-- Route piétonne entre deux nœuds — retourne les segments GeoJSON
CREATE OR REPLACE FUNCTION public.get_walking_route(
  from_node bigint,
  to_node   bigint
)
RETURNS TABLE (
  seq      integer,
  edge_id  bigint,
  cost_sec double precision,
  geojson  text
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
BEGIN
  IF (SELECT count(*) FROM public.streets WHERE source IS NOT NULL AND target IS NOT NULL) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    d.seq,
    d.edge::bigint AS edge_id,
    d.cost AS cost_sec,
    ST_AsGeoJSON(s.geom) AS geojson
  FROM pgr_dijkstra(
    'SELECT id, source, target, cost, reverse_cost FROM public.streets_walking_cost',
    from_node,
    to_node,
    directed := false
  ) d
  JOIN public.streets s ON d.edge = s.id
  ORDER BY d.seq;
END;
$$;

-- Statistiques du graphe piéton (pour AdminHealth)
CREATE OR REPLACE FUNCTION public.get_graph_stats()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'node_count',   (SELECT count(*) FROM public.street_nodes),
    'edge_count',   (SELECT count(*) FROM public.streets),
    'poi_linked',   (SELECT count(*) FROM public.medina_pois WHERE nearest_node_id IS NOT NULL),
    'poi_total',    (SELECT count(*) FROM public.medina_pois WHERE is_active = true),
    'graph_ready',  (SELECT count(*) FROM public.streets WHERE source IS NOT NULL AND target IS NOT NULL) > 0
  ) INTO result;
  RETURN result;
END;
$$;
