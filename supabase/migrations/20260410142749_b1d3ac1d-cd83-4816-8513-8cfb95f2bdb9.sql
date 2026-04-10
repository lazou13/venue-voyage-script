-- Extend medina_pois table for POI enrichment (Sprint 2)

-- Wikidata Enrichment (5 columns)
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS wikidata_description TEXT;
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS historical_period TEXT;
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS architect TEXT;
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS construction_date TEXT;
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS unesco_status BOOLEAN DEFAULT FALSE;

-- AI-Generated Content (6 columns)
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS story_fr TEXT;
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS story_en TEXT;
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS story_ar TEXT;
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS fun_facts JSONB DEFAULT '[]'::jsonb;
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS visitor_tips JSONB DEFAULT '[]'::jsonb;
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS accessibility_info TEXT;

-- Media URLs (4 columns)
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS hero_image TEXT;
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS thumbnail TEXT;
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS wikimedia_images JSONB DEFAULT '[]'::jsonb;
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS media_attribution TEXT;

-- Quest Metadata (4 columns)
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS difficulty_score INTEGER;
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS photo_opportunity_score INTEGER;
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS historical_significance INTEGER;
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS average_visit_duration INTEGER;

-- Add check constraints via triggers (avoiding immutable CHECK issues)
CREATE OR REPLACE FUNCTION public.validate_medina_pois_scores()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.difficulty_score IS NOT NULL AND (NEW.difficulty_score < 1 OR NEW.difficulty_score > 10) THEN
    RAISE EXCEPTION 'difficulty_score must be between 1 and 10';
  END IF;
  IF NEW.photo_opportunity_score IS NOT NULL AND (NEW.photo_opportunity_score < 1 OR NEW.photo_opportunity_score > 10) THEN
    RAISE EXCEPTION 'photo_opportunity_score must be between 1 and 10';
  END IF;
  IF NEW.historical_significance IS NOT NULL AND (NEW.historical_significance < 1 OR NEW.historical_significance > 10) THEN
    RAISE EXCEPTION 'historical_significance must be between 1 and 10';
  END IF;
  IF NEW.treasure_hunt_score IS NOT NULL AND (NEW.treasure_hunt_score < 0 OR NEW.treasure_hunt_score > 10) THEN
    RAISE EXCEPTION 'treasure_hunt_score must be between 0 and 10';
  END IF;
  IF NEW.guided_tour_score IS NOT NULL AND (NEW.guided_tour_score < 0 OR NEW.guided_tour_score > 10) THEN
    RAISE EXCEPTION 'guided_tour_score must be between 0 and 10';
  END IF;
  IF NEW.team_building_score IS NOT NULL AND (NEW.team_building_score < 0 OR NEW.team_building_score > 10) THEN
    RAISE EXCEPTION 'team_building_score must be between 0 and 10';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trg_validate_medina_pois_scores
BEFORE INSERT OR UPDATE ON medina_pois
FOR EACH ROW EXECUTE FUNCTION public.validate_medina_pois_scores();

-- QuestEngine Scoring (3 columns)
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS treasure_hunt_score NUMERIC(4,2);
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS guided_tour_score NUMERIC(4,2);
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS team_building_score NUMERIC(4,2);

-- Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_medina_pois_wikidata_qid ON medina_pois(wikidata_id);
CREATE INDEX IF NOT EXISTS idx_medina_pois_enrichment_status ON medina_pois(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_medina_pois_scores ON medina_pois(treasure_hunt_score, guided_tour_score, team_building_score);

-- Documentation
COMMENT ON TABLE medina_pois IS 'Extended with enrichment fields for Wikidata, AI content, media, and quest scoring (Sprint 2)';