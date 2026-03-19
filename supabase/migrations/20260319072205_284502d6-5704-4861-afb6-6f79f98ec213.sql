
-- Table generated_quests
CREATE TABLE IF NOT EXISTS generated_quests (
  id                UUID PRIMARY KEY,
  mode              TEXT NOT NULL,
  theme             TEXT NOT NULL,
  difficulty        TEXT NOT NULL,
  start_lat         DOUBLE PRECISION NOT NULL,
  start_lng         DOUBLE PRECISION NOT NULL,
  start_name        TEXT,
  total_stops       INTEGER,
  total_distance_m  INTEGER,
  total_time_min    INTEGER,
  total_points      INTEGER,
  stops_data        JSONB,
  generated_at      TIMESTAMPTZ DEFAULT now(),
  played_at         TIMESTAMPTZ,
  player_session_id TEXT
);

-- Validation trigger instead of CHECK constraint
CREATE OR REPLACE FUNCTION public.validate_generated_quest_mode()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.mode NOT IN ('treasure_hunt', 'guided_tour') THEN
    RAISE EXCEPTION 'Invalid generated_quests mode: %', NEW.mode;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_generated_quest_mode
  BEFORE INSERT OR UPDATE ON generated_quests
  FOR EACH ROW EXECUTE FUNCTION public.validate_generated_quest_mode();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gen_quests_mode ON generated_quests (mode);
CREATE INDEX IF NOT EXISTS idx_gen_quests_theme ON generated_quests (theme);
CREATE INDEX IF NOT EXISTS idx_gen_quests_generated_at ON generated_quests (generated_at DESC);

-- RLS
ALTER TABLE generated_quests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage generated_quests"
  ON generated_quests FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
