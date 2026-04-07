
-- Chantier 1: validated_at column
ALTER TABLE public.medina_pois ADD COLUMN IF NOT EXISTS validated_at timestamp with time zone DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_medina_pois_status ON public.medina_pois (status);

-- Chantier 2: watchdog_reports table
CREATE TABLE public.watchdog_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  report_type text NOT NULL,
  severity text NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  summary text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamp with time zone
);
ALTER TABLE public.watchdog_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage watchdog_reports" ON public.watchdog_reports FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Chantier 3: quest_photos table
CREATE TABLE public.quest_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  quest_instance_id uuid REFERENCES public.quest_instances(id) ON DELETE CASCADE,
  medina_poi_id uuid REFERENCES public.medina_pois(id) ON DELETE SET NULL,
  storage_path text NOT NULL,
  storage_bucket text NOT NULL DEFAULT 'quest-photos',
  caption text,
  media_type text NOT NULL DEFAULT 'photo',
  lat double precision,
  lng double precision,
  device_id text
);
ALTER TABLE public.quest_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert quest_photos" ON public.quest_photos FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admins can manage quest_photos" ON public.quest_photos FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- client_poi_recommendations table
CREATE TABLE public.client_poi_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  medina_poi_id uuid REFERENCES public.medina_pois(id) ON DELETE SET NULL,
  comment text,
  rating smallint CHECK (rating BETWEEN 1 AND 5),
  photo_url text,
  source_instance_id uuid REFERENCES public.quest_instances(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_at timestamp with time zone,
  poi_name text,
  lat double precision,
  lng double precision
);
ALTER TABLE public.client_poi_recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can insert recommendations" ON public.client_poi_recommendations FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Admins can manage recommendations" ON public.client_poi_recommendations FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Storage bucket for quest photos
INSERT INTO storage.buckets (id, name, public) VALUES ('quest-photos', 'quest-photos', true) ON CONFLICT (id) DO NOTHING;
CREATE POLICY "Anyone can upload quest photos" ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = 'quest-photos');
CREATE POLICY "Anyone can read quest photos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'quest-photos');
