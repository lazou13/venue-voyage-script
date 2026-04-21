UPDATE public.medina_pois
SET 
  category = 'place',
  metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
    'recat_batch', 'lot1a_restaurant_fix',
    'recat_from', 'restaurant',
    'recat_applied_at', now(),
    'recat_reason', 'jemaa_el_fna_is_public_square_not_restaurant'
  ),
  updated_at = now()
WHERE id = '6d7f3e3f-9dfe-4877-9682-8e544068ea3f'
  AND category = 'restaurant';