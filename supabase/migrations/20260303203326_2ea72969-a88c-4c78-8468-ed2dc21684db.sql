
-- 1. Add status column
ALTER TABLE public.medina_pois
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

-- 2. Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_medina_poi_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('draft', 'validated') THEN
    RAISE EXCEPTION 'Invalid medina_pois status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_medina_poi_status
BEFORE INSERT OR UPDATE ON public.medina_pois
FOR EACH ROW
EXECUTE FUNCTION public.validate_medina_poi_status();

-- 3. Set existing active POIs to validated
UPDATE public.medina_pois SET status = 'validated' WHERE is_active = true;
