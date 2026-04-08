
CREATE TABLE public.poi_quality_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dry_run BOOLEAN NOT NULL DEFAULT true,
  total_pois INTEGER,
  issues_detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  auto_fixed INTEGER NOT NULL DEFAULT 0,
  needs_review INTEGER NOT NULL DEFAULT 0,
  quality_score REAL,
  pois_to_review UUID[] DEFAULT '{}'::uuid[]
);

ALTER TABLE public.poi_quality_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage poi_quality_reports"
ON public.poi_quality_reports
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
