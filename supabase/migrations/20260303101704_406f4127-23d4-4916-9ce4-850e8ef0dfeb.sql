
-- ============================================================
-- RLS LOCKDOWN: Replace permissive USING(true) on 7 tables
-- ============================================================

-- ── 1. PROJECTS ──
-- Drop old permissive policy
DROP POLICY IF EXISTS "Allow all access to projects" ON public.projects;

-- Public can only SELECT projects marked as public catalog
CREATE POLICY "Public can read catalog projects"
ON public.projects FOR SELECT
USING (
  (quest_config->'catalog'->>'is_public')::boolean = true
);

-- Admins can read ALL projects
CREATE POLICY "Admins can select all projects"
ON public.projects FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin CUD
CREATE POLICY "Admins can insert projects"
ON public.projects FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update projects"
ON public.projects FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete projects"
ON public.projects FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ── 2. POIS ──
DROP POLICY IF EXISTS "Allow all access to pois" ON public.pois;

-- Public can only SELECT pois belonging to public catalog projects
CREATE POLICY "Public can read catalog pois"
ON public.pois FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = pois.project_id
      AND (p.quest_config->'catalog'->>'is_public')::boolean = true
  )
);

-- Admins can read ALL pois
CREATE POLICY "Admins can select all pois"
ON public.pois FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Admin CUD
CREATE POLICY "Admins can insert pois"
ON public.pois FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update pois"
ON public.pois FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete pois"
ON public.pois FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ── 3. ROUTE_TRACES ──
DROP POLICY IF EXISTS "Allow all access to route_traces" ON public.route_traces;

CREATE POLICY "Admins can manage route_traces"
ON public.route_traces FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── 4. ROUTE_MARKERS ──
DROP POLICY IF EXISTS "Allow all access to route_markers" ON public.route_markers;

CREATE POLICY "Admins can manage route_markers"
ON public.route_markers FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── 5. WIFI_ZONES ──
DROP POLICY IF EXISTS "Allow all access to wifi_zones" ON public.wifi_zones;

CREATE POLICY "Admins can manage wifi_zones"
ON public.wifi_zones FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── 6. FORBIDDEN_ZONES ──
DROP POLICY IF EXISTS "Allow all access to forbidden_zones" ON public.forbidden_zones;

CREATE POLICY "Admins can manage forbidden_zones"
ON public.forbidden_zones FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── 7. AVATARS ──
DROP POLICY IF EXISTS "Allow all access to avatars" ON public.avatars;

CREATE POLICY "Admins can manage avatars"
ON public.avatars FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ── INDEX for catalog slug lookups (R3 optimization) ──
CREATE INDEX IF NOT EXISTS idx_projects_catalog_slug
ON public.projects USING btree (((quest_config->'catalog'->>'slug')));
