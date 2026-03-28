-- ============================================================
-- Audit cleanup: ensure all legacy USING(true) policies are
-- dropped. Migration 20260303101704 already drops most of them,
-- but this migration is idempotent and acts as a safety net.
-- ============================================================

-- Projects (already dropped in 20260303101704 but kept for safety)
DROP POLICY IF EXISTS "Allow all access to projects" ON public.projects;

-- POIs
DROP POLICY IF EXISTS "Allow all access to pois" ON public.pois;

-- Wifi zones
DROP POLICY IF EXISTS "Allow all access to wifi_zones" ON public.wifi_zones;

-- Forbidden zones
DROP POLICY IF EXISTS "Allow all access to forbidden_zones" ON public.forbidden_zones;

-- Avatars
DROP POLICY IF EXISTS "Allow all access to avatars" ON public.avatars;

-- Route traces
DROP POLICY IF EXISTS "Allow all access to route_traces" ON public.route_traces;

-- Route markers
DROP POLICY IF EXISTS "Allow all access to route_markers" ON public.route_markers;

-- ============================================================
-- Tighten storage bucket policies for 'fieldwork'
-- Previously: fully public (any anon can upload/delete)
-- After: anon SELECT only; authenticated INSERT/UPDATE/DELETE
-- ============================================================
DROP POLICY IF EXISTS "Public read fieldwork" ON storage.objects;
DROP POLICY IF EXISTS "Public upload fieldwork" ON storage.objects;
DROP POLICY IF EXISTS "Public update fieldwork" ON storage.objects;
DROP POLICY IF EXISTS "Public delete fieldwork" ON storage.objects;

CREATE POLICY "Public read fieldwork"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'fieldwork');

CREATE POLICY "Authenticated upload fieldwork"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'fieldwork');

CREATE POLICY "Authenticated update fieldwork"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'fieldwork');

CREATE POLICY "Authenticated delete fieldwork"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'fieldwork');
