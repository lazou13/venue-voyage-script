
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-media', 'client-media', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can upload to client-media"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'client-media');

CREATE POLICY "Admins full access client-media"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'client-media' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'client-media' AND public.has_role(auth.uid(), 'admin'));
