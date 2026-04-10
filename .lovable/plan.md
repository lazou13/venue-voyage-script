

## Extend medina_pois table for POI enrichment

### Summary

Create migration file to add 23 new columns for Wikidata enrichment, AI-generated content, media URLs, quest metadata, and QuestEngine scoring.

### Database Changes

**Migration file:** `supabase/migrations/20260410143000_extend_medina_pois_enrichment.sql`

**Columns to add:**

```sql
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
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS difficulty_score INTEGER CHECK (difficulty_score >= 1 AND difficulty_score <= 10);
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS photo_opportunity_score INTEGER CHECK (photo_opportunity_score >= 1 AND photo_opportunity_score <= 10);
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS historical_significance INTEGER CHECK (historical_significance >= 1 AND historical_significance <= 10);
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS average_visit_duration INTEGER;

-- QuestEngine Scoring (3 columns)
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS treasure_hunt_score NUMERIC(4,2) CHECK (treasure_hunt_score >= 0 AND treasure_hunt_score <= 10);
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS guided_tour_score NUMERIC(4,2) CHECK (guided_tour_score >= 0 AND guided_tour_score <= 10);
ALTER TABLE medina_pois ADD COLUMN IF NOT EXISTS team_building_score NUMERIC(4,2) CHECK (team_building_score >= 0 AND team_building_score <= 10);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_medina_pois_wikidata_qid ON medina_pois(wikidata_id);
CREATE INDEX IF NOT EXISTS idx_medina_pois_enrichment_status ON medina_pois(enrichment_status);
CREATE INDEX IF NOT EXISTS idx_medina_pois_scores ON medina_pois(treasure_hunt_score, guided_tour_score, team_building_score);

-- Documentation
COMMENT ON TABLE medina_pois IS 'Extended with enrichment fields for Wikidata, AI content, media, and quest scoring (Sprint 2)';
```

### Post-Migration Verification

1. Execute migration via database migration tool
2. Verify columns added: `\d medina_pois`
3. Confirm indexes created
4. Check `src/integrations/supabase/types.ts` auto-updates

