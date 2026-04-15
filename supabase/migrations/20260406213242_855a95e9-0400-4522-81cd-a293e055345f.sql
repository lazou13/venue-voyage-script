
ALTER TABLE public.medina_pois
  ADD COLUMN IF NOT EXISTS local_anecdote_fr TEXT,
  ADD COLUMN IF NOT EXISTS local_anecdote_en TEXT,
  ADD COLUMN IF NOT EXISTS fun_fact_fr TEXT,
  ADD COLUMN IF NOT EXISTS fun_fact_en TEXT,
  ADD COLUMN IF NOT EXISTS crowd_level TEXT,
  ADD COLUMN IF NOT EXISTS accessibility_notes TEXT;

-- Validation trigger for crowd_level
CREATE OR REPLACE FUNCTION public.validate_crowd_level()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.crowd_level IS NOT NULL AND NEW.crowd_level NOT IN ('low', 'medium', 'high') THEN
    RAISE EXCEPTION 'crowd_level must be low, medium, or high';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_crowd_level ON public.medina_pois;
CREATE TRIGGER trg_validate_crowd_level
  BEFORE INSERT OR UPDATE ON public.medina_pois
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_crowd_level();

-- Copy existing local_anecdote into local_anecdote_fr
UPDATE public.medina_pois
SET local_anecdote_fr = local_anecdote
WHERE local_anecdote IS NOT NULL
  AND local_anecdote_fr IS NULL;
