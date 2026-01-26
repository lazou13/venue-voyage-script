-- Create enum types
CREATE TYPE wifi_strength AS ENUM ('ok', 'weak', 'dead');
CREATE TYPE risk_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE interaction_type AS ENUM ('puzzle', 'qr_scan', 'photo', 'hidden_object', 'npc', 'audio');
CREATE TYPE difficulty_level AS ENUM ('easy', 'medium', 'hard');

-- Projects table (main intake form)
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Hotel info
  hotel_name TEXT NOT NULL,
  city TEXT NOT NULL,
  floors INTEGER NOT NULL DEFAULT 1,
  visit_date DATE,
  
  -- Map
  map_url TEXT,
  map_uploaded_at TIMESTAMP WITH TIME ZONE,
  
  -- Ops constraints
  staff_available BOOLEAN DEFAULT false,
  reset_time_mins INTEGER,
  props_allowed BOOLEAN DEFAULT true,
  
  -- Design choices
  target_duration_mins INTEGER,
  difficulty difficulty_level,
  theme TEXT,
  
  -- Status
  is_complete BOOLEAN DEFAULT false
);

-- Points of Interest
CREATE TABLE public.pois (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  name TEXT NOT NULL,
  zone TEXT NOT NULL,
  photo_url TEXT,
  interaction interaction_type NOT NULL DEFAULT 'puzzle',
  risk risk_level NOT NULL DEFAULT 'low',
  minutes_from_prev INTEGER DEFAULT 0,
  notes TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Wi-Fi zones
CREATE TABLE public.wifi_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  zone TEXT NOT NULL,
  strength wifi_strength NOT NULL DEFAULT 'ok'
);

-- Forbidden zones
CREATE TABLE public.forbidden_zones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  zone TEXT NOT NULL,
  reason TEXT
);

-- Enable RLS
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pois ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wifi_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forbidden_zones ENABLE ROW LEVEL SECURITY;

-- Public access policies (no auth for MVP - on-site tool)
CREATE POLICY "Allow all access to projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to pois" ON public.pois FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to wifi_zones" ON public.wifi_zones FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to forbidden_zones" ON public.forbidden_zones FOR ALL USING (true) WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_pois_project ON public.pois(project_id);
CREATE INDEX idx_wifi_zones_project ON public.wifi_zones(project_id);
CREATE INDEX idx_forbidden_zones_project ON public.forbidden_zones(project_id);

-- Update trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for maps and photos
INSERT INTO storage.buckets (id, name, public) VALUES ('fieldwork', 'fieldwork', true);

-- Storage policies
CREATE POLICY "Public read fieldwork" ON storage.objects FOR SELECT USING (bucket_id = 'fieldwork');
CREATE POLICY "Public upload fieldwork" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'fieldwork');
CREATE POLICY "Public update fieldwork" ON storage.objects FOR UPDATE USING (bucket_id = 'fieldwork');
CREATE POLICY "Public delete fieldwork" ON storage.objects FOR DELETE USING (bucket_id = 'fieldwork');