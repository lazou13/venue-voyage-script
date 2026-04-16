INSERT INTO storage.buckets (id, name, public) VALUES ('audio-guides', 'audio-guides', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read audio-guides" ON storage.objects FOR SELECT USING (bucket_id = 'audio-guides');

CREATE POLICY "Service role upload audio-guides" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'audio-guides' AND auth.role() = 'service_role');

CREATE POLICY "Service role update audio-guides" ON storage.objects FOR UPDATE USING (bucket_id = 'audio-guides' AND auth.role() = 'service_role');

CREATE POLICY "Service role delete audio-guides" ON storage.objects FOR DELETE USING (bucket_id = 'audio-guides' AND auth.role() = 'service_role');