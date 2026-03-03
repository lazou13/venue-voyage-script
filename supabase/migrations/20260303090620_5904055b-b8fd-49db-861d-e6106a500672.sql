
-- PATCH 1.1: Add extra jsonb column to poi_media for width/height/duration metadata
ALTER TABLE public.poi_media ADD COLUMN extra jsonb NOT NULL DEFAULT '{}';
