
-- PATCH 2: Add library_poi_id to pois for medina import tracking
ALTER TABLE public.pois ADD COLUMN library_poi_id uuid REFERENCES public.medina_pois(id) ON DELETE SET NULL;
