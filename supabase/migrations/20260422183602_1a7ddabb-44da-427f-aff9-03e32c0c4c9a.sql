-- LOT-AUD-3 : table de marquage des audios irrécupérables
CREATE TABLE IF NOT EXISTS public.audio_irrecoverable (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poi_id uuid NOT NULL,
  field_name text NOT NULL,
  original_url text NOT NULL,
  host text,
  http_status integer,
  reason text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  needs_regeneration boolean NOT NULL DEFAULT true,
  regenerated_at timestamptz,
  notes text,
  UNIQUE (poi_id, field_name, original_url)
);

ALTER TABLE public.audio_irrecoverable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage audio_irrecoverable"
ON public.audio_irrecoverable
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX IF NOT EXISTS idx_audio_irrecoverable_poi ON public.audio_irrecoverable(poi_id);
CREATE INDEX IF NOT EXISTS idx_audio_irrecoverable_needs_regen ON public.audio_irrecoverable(needs_regeneration) WHERE needs_regeneration = true;