
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Add 9 new columns to medina_pois for agent enrichment
ALTER TABLE public.medina_pois
  ADD COLUMN IF NOT EXISTS audience_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS accessibility_notes text,
  ADD COLUMN IF NOT EXISTS street_food_spot boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS street_food_details text,
  ADD COLUMN IF NOT EXISTS instagram_score integer,
  ADD COLUMN IF NOT EXISTS instagram_tips text,
  ADD COLUMN IF NOT EXISTS route_tags text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS best_time_visit text,
  ADD COLUMN IF NOT EXISTS agent_enriched_at timestamptz;

-- Create quest_library table
CREATE TABLE public.quest_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_hub text NOT NULL,
  start_lat double precision NOT NULL,
  start_lng double precision NOT NULL,
  audience text NOT NULL,
  mode text NOT NULL DEFAULT 'guided_tour',
  theme text NOT NULL DEFAULT 'complete',
  difficulty text NOT NULL DEFAULT 'easy',
  title_fr text,
  title_en text,
  description_fr text,
  description_en text,
  duration_min integer,
  distance_m integer,
  stops_count integer,
  stops_data jsonb DEFAULT '[]'::jsonb,
  highlights text[] DEFAULT '{}',
  best_time text,
  agent_version text DEFAULT 'v1.0',
  generated_at timestamptz DEFAULT now(),
  quality_score numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on quest_library
ALTER TABLE public.quest_library ENABLE ROW LEVEL SECURITY;

-- Admin policies for quest_library
CREATE POLICY "Admins can manage quest_library"
  ON public.quest_library
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Public read for quest_library (used by public experience pages)
CREATE POLICY "Public can read quest_library"
  ON public.quest_library
  FOR SELECT
  TO public
  USING (true);
