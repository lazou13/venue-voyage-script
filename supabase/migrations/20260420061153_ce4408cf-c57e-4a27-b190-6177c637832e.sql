CREATE OR REPLACE FUNCTION public.merge_duplicate_pois()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_merged int := 0;
  v_media_reassigned int := 0;
  v_tmp int := 0;
  rec RECORD;
  v_keep uuid;
  v_remove uuid;
  v_sample text[] := '{}';
BEGIN
  FOR rec IN
    WITH pairs AS (
      SELECT
        a.id AS id_a,
        b.id AS id_b,
        a.name AS name_a,
        b.name AS name_b,
        COALESCE(a.poi_quality_score, 0)
          + COALESCE(a.reviews_count, 0) * 0.01
          + (CASE WHEN a.history_context IS NOT NULL THEN 5 ELSE 0 END)
          + (CASE WHEN a.hero_image IS NOT NULL THEN 2 ELSE 0 END)
          AS score_a,
        COALESCE(b.poi_quality_score, 0)
          + COALESCE(b.reviews_count, 0) * 0.01
          + (CASE WHEN b.history_context IS NOT NULL THEN 5 ELSE 0 END)
          + (CASE WHEN b.hero_image IS NOT NULL THEN 2 ELSE 0 END)
          AS score_b
      FROM medina_pois a
      JOIN medina_pois b
        ON a.id < b.id
       AND a.status NOT IN ('filtered','merged')
       AND b.status NOT IN ('filtered','merged')
       AND a.lat IS NOT NULL AND b.lat IS NOT NULL
       AND COALESCE(a.category_ai, '') = COALESCE(b.category_ai, '')
       AND lower(regexp_replace(trim(a.name), '\s+', ' ', 'g'))
         = lower(regexp_replace(trim(b.name), '\s+', ' ', 'g'))
       AND (
         6371000 * 2 * asin(sqrt(
           power(sin(radians(b.lat - a.lat) / 2), 2)
           + cos(radians(a.lat)) * cos(radians(b.lat))
           * power(sin(radians(b.lng - a.lng) / 2), 2)
         ))
       ) < 25
    )
    SELECT
      CASE WHEN score_a >= score_b THEN id_a ELSE id_b END AS keep_id,
      CASE WHEN score_a >= score_b THEN id_b ELSE id_a END AS remove_id,
      CASE WHEN score_a >= score_b THEN name_b ELSE name_a END AS removed_name
    FROM pairs
  LOOP
    v_keep   := rec.keep_id;
    v_remove := rec.remove_id;

    IF EXISTS (SELECT 1 FROM medina_pois WHERE id = v_remove AND status = 'merged') THEN
      CONTINUE;
    END IF;
    IF EXISTS (SELECT 1 FROM medina_pois WHERE id = v_keep AND status = 'merged') THEN
      CONTINUE;
    END IF;

    UPDATE poi_media
       SET medina_poi_id = v_keep
     WHERE medina_poi_id = v_remove;
    GET DIAGNOSTICS v_tmp = ROW_COUNT;
    v_media_reassigned := v_media_reassigned + v_tmp;

    UPDATE medina_pois
       SET status = 'merged',
           is_active = false,
           updated_at = now()
     WHERE id = v_remove;
    GET DIAGNOSTICS v_tmp = ROW_COUNT;
    v_merged := v_merged + v_tmp;

    IF array_length(v_sample, 1) IS NULL OR array_length(v_sample, 1) < 10 THEN
      v_sample := array_append(v_sample, rec.removed_name);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'merged', v_merged,
    'media_reassigned', v_media_reassigned,
    'sample_removed', v_sample
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.clean_low_quality_pois()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_filtered int;
  v_sample text[];
BEGIN
  WITH targets AS (
    SELECT id, name
    FROM medina_pois
    WHERE enrichment_status = 'enriched'
      AND status NOT IN ('filtered','merged')
      AND (reviews_count < 10 AND (rating IS NULL OR rating < 3.5))
      AND category_ai NOT IN ('monument', 'museum', 'historic_site', 'mosquee', 'fontaine', 'porte', 'medersa', 'palais', 'tombeau', 'jardin')
  ), upd AS (
    UPDATE medina_pois m
       SET status = 'filtered',
           is_active = false,
           updated_at = now()
      FROM targets t
     WHERE m.id = t.id
     RETURNING m.id, m.name
  )
  SELECT count(*)::int, COALESCE(array_agg(name) FILTER (WHERE name IS NOT NULL), '{}')
    INTO v_filtered, v_sample
  FROM upd;

  RETURN jsonb_build_object(
    'filtered', v_filtered,
    'sample_removed', (SELECT COALESCE(array_agg(n), '{}'::text[]) FROM (SELECT unnest(v_sample) AS n LIMIT 10) s)
  );
END;
$function$;