
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS must_see_details_en text DEFAULT NULL;
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS must_try_en text DEFAULT NULL;
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS must_visit_nearby_en text DEFAULT NULL;
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS photo_tip_en text DEFAULT NULL;
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS tourist_tips_en text DEFAULT NULL;
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS price_info_en text DEFAULT NULL;
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS accessibility_notes_en text DEFAULT NULL;
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS best_time_visit_en text DEFAULT NULL;
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS street_food_details_en text DEFAULT NULL;
