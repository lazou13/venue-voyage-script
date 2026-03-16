
-- Update the status validation trigger to support pipeline statuses
CREATE OR REPLACE FUNCTION public.validate_medina_poi_status()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status NOT IN ('draft', 'validated', 'raw', 'processing', 'classified', 'enriched', 'filtered', 'merged') THEN
    RAISE EXCEPTION 'Invalid medina_pois status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$function$;
