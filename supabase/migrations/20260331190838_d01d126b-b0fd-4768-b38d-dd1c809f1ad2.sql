
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS price_info text;
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS opening_hours jsonb;
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS must_see_details text;
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS must_try text;
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS must_visit_nearby text;
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS is_photo_spot boolean DEFAULT false;
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS photo_tip text;
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS ruelle_etroite boolean DEFAULT false;
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS wikipedia_summary text;
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS website_url text;

UPDATE public.medina_pois SET website_url = website WHERE website IS NOT NULL AND website_url IS NULL;
UPDATE public.medina_pois SET is_photo_spot = instagram_spot WHERE instagram_spot = true AND (is_photo_spot IS NULL OR is_photo_spot = false);
