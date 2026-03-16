
-- Add missing columns for POI classification and quality scoring
ALTER TABLE medina_pois
ADD COLUMN IF NOT EXISTS subcategory text,
ADD COLUMN IF NOT EXISTS poi_quality_score numeric,
ADD COLUMN IF NOT EXISTS tourist_interest text;

-- Create cleanup function: mark low-quality POIs as 'filtered'
CREATE OR REPLACE FUNCTION public.clean_low_quality_pois()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_filtered int;
BEGIN
  UPDATE medina_pois
  SET status = 'filtered'
  WHERE enrichment_status = 'enriched'
    AND status != 'filtered'
    AND (reviews_count < 10 AND (rating IS NULL OR rating < 3.5))
    AND category_ai NOT IN ('monument', 'museum', 'historic_site', 'mosquee', 'fontaine', 'porte');
  GET DIAGNOSTICS v_filtered = ROW_COUNT;
  RETURN jsonb_build_object('filtered', v_filtered);
END;
$$;

-- Create duplicate merge function using Haversine distance
CREATE OR REPLACE FUNCTION public.merge_duplicate_pois()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_merged int := 0;
  rec RECORD;
BEGIN
  -- Find pairs within 15m with similar names, keep the one with more reviews
  FOR rec IN
    SELECT a.id AS remove_id, b.id AS keep_id
    FROM medina_pois a
    JOIN medina_pois b ON a.id < b.id
      AND a.status != 'filtered' AND b.status != 'filtered'
      AND a.lat IS NOT NULL AND b.lat IS NOT NULL
      -- Haversine approximation: ~15m threshold
      AND (
        6371000 * 2 * asin(sqrt(
          power(sin(radians(b.lat - a.lat) / 2), 2)
          + cos(radians(a.lat)) * cos(radians(b.lat))
          * power(sin(radians(b.lng - a.lng) / 2), 2)
        ))
      ) < 15
      -- Name similarity using trigram if available, else exact lower match
      AND lower(trim(a.name)) = lower(trim(b.name))
    WHERE COALESCE(a.reviews_count, 0) <= COALESCE(b.reviews_count, 0)
  LOOP
    UPDATE medina_pois SET status = 'merged' WHERE id = rec.remove_id AND status != 'merged';
    GET DIAGNOSTICS v_merged = ROW_COUNT;
  END LOOP;

  RETURN jsonb_build_object('merged', v_merged);
END;
$$;
