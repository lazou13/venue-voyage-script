
-- ============================================
-- PATCH 1: Medina POI Library + POI Media
-- ============================================

-- 1A. Table: medina_pois (bibliothèque POI réutilisable)
CREATE TABLE public.medina_pois (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  name text NOT NULL,
  zone text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'generic',
  lat double precision,
  lng double precision,
  radius_m int NOT NULL DEFAULT 30,
  step_config jsonb NOT NULL DEFAULT '{}',
  metadata jsonb NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true
);

-- 1B. Table: poi_media (médiathèque multi-assets)
CREATE TABLE public.poi_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  medina_poi_id uuid NOT NULL REFERENCES public.medina_pois(id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('photo','audio','video')),
  storage_bucket text NOT NULL DEFAULT 'poi-media',
  storage_path text NOT NULL,
  mime_type text,
  size_bytes bigint,
  duration_sec int,
  caption text,
  role_tags jsonb NOT NULL DEFAULT '[]',
  is_cover boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 1C. updated_at trigger on medina_pois (reuse existing function)
CREATE TRIGGER update_medina_pois_updated_at
  BEFORE UPDATE ON public.medina_pois
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 1D. RLS: admin-only for medina_pois
ALTER TABLE public.medina_pois ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select medina_pois"
  ON public.medina_pois FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert medina_pois"
  ON public.medina_pois FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update medina_pois"
  ON public.medina_pois FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete medina_pois"
  ON public.medina_pois FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS: admin-only for poi_media
ALTER TABLE public.poi_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select poi_media"
  ON public.poi_media FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert poi_media"
  ON public.poi_media FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update poi_media"
  ON public.poi_media FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete poi_media"
  ON public.poi_media FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 1E. Storage bucket: private
INSERT INTO storage.buckets (id, name, public) VALUES ('poi-media', 'poi-media', false);

-- Storage policies: admin-only
CREATE POLICY "Admins can select poi-media objects"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'poi-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert poi-media objects"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'poi-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update poi-media objects"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'poi-media' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'poi-media' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete poi-media objects"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'poi-media' AND public.has_role(auth.uid(), 'admin'));
