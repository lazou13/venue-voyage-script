-- Create table for route traces (GeoJSON LineString storage)
CREATE TABLE public.route_traces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text,
  geojson jsonb NOT NULL DEFAULT '{"type": "LineString", "coordinates": []}'::jsonb,
  started_at timestamptz,
  ended_at timestamptz,
  distance_meters numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create table for route markers (notes with optional photo)
CREATE TABLE public.route_markers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id uuid NOT NULL REFERENCES public.route_traces(id) ON DELETE CASCADE,
  lat numeric NOT NULL,
  lng numeric NOT NULL,
  note text,
  photo_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.route_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_markers ENABLE ROW LEVEL SECURITY;

-- RLS policies for route_traces
CREATE POLICY "Allow all access to route_traces"
ON public.route_traces
FOR ALL
USING (true)
WITH CHECK (true);

-- RLS policies for route_markers
CREATE POLICY "Allow all access to route_markers"
ON public.route_markers
FOR ALL
USING (true)
WITH CHECK (true);

-- Indexes for performance
CREATE INDEX idx_route_traces_project_id ON public.route_traces(project_id);
CREATE INDEX idx_route_markers_trace_id ON public.route_markers(trace_id);