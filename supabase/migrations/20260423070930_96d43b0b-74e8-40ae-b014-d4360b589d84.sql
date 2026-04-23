CREATE TABLE IF NOT EXISTS public.medina_pois_metadata_backup_qrp_v1 AS
SELECT id, metadata, now() AS snapshot_at
FROM public.medina_pois
WHERE is_active = true;

ALTER TABLE public.medina_pois_metadata_backup_qrp_v1 ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage qrp v1 backup"
ON public.medina_pois_metadata_backup_qrp_v1
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));