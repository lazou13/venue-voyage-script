
INSERT INTO storage.buckets (id, name, public)
VALUES ('poi-images', 'poi-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read poi-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'poi-images');

CREATE POLICY "Service role upload poi-images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'poi-images');

CREATE POLICY "Service role update poi-images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'poi-images');

CREATE POLICY "Service role delete poi-images"
ON storage.objects FOR DELETE
USING (bucket_id = 'poi-images' AND has_role(auth.uid(), 'admin'::app_role));
