
CREATE TABLE public.quest_narratives_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signature text UNIQUE NOT NULL,
  narrative_version text NOT NULL,
  theme text NOT NULL,
  audience text NOT NULL,
  difficulty int NOT NULL,
  poi_ids jsonb NOT NULL,
  narrative jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quest_narratives_cache_signature ON public.quest_narratives_cache (signature);

ALTER TABLE public.quest_narratives_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage quest_narratives_cache"
  ON public.quest_narratives_cache
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
