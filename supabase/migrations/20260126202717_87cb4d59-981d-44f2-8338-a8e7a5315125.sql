-- Create avatars table for narrator gallery
CREATE TABLE public.avatars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  style text NOT NULL CHECK (style IN ('cartoon', 'realistic', 'semi_realistic', 'anime', 'minimal')),
  age text NOT NULL CHECK (age IN ('child', 'teen', 'adult', 'senior')),
  persona text NOT NULL CHECK (persona IN ('guide_host', 'detective', 'explorer', 'historian', 'local_character', 'mascot', 'ai_assistant', 'villain_light')),
  outfit text NOT NULL CHECK (outfit IN ('traditional', 'modern', 'luxury', 'adventure')),
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;

-- Allow all access (matching other tables pattern)
CREATE POLICY "Allow all access to avatars" ON public.avatars FOR ALL USING (true) WITH CHECK (true);