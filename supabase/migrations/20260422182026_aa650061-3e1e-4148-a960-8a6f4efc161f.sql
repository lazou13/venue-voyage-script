CREATE TABLE IF NOT EXISTS public.audio_inventory_snapshot (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  probed_at timestamptz NOT NULL DEFAULT now(),
  poi_id uuid NOT NULL,
  name text,
  field_name text NOT NULL,
  url text NOT NULL,
  host text,
  storage_owner_guess text,
  http_status integer,
  content_length bigint,
  content_type text,
  last_modified text,
  error text
);

CREATE INDEX IF NOT EXISTS idx_audio_inv_run ON public.audio_inventory_snapshot(run_id);
CREATE INDEX IF NOT EXISTS idx_audio_inv_host ON public.audio_inventory_snapshot(host);
CREATE INDEX IF NOT EXISTS idx_audio_inv_field ON public.audio_inventory_snapshot(field_name);
CREATE INDEX IF NOT EXISTS idx_audio_inv_poi ON public.audio_inventory_snapshot(poi_id);

ALTER TABLE public.audio_inventory_snapshot ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage audio_inventory_snapshot"
ON public.audio_inventory_snapshot
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));