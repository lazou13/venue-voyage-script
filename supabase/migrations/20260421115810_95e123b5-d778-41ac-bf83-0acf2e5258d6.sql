-- LOT 1A — Stabilisation des hubs canoniques
-- Traçabilité: metadata.hub_promoted_at / hub_promotion_reason / hub_previous_state

-- 1) Koutoubia: déjà OK, on aligne juste hub_theme
UPDATE public.medina_pois SET
  hub_theme = 'monuments_historiques',
  metadata = metadata
    || jsonb_build_object(
      'hub_promoted_at', now(),
      'hub_promotion_reason', 'lot1a_canonical_hub_stabilization',
      'hub_previous_state', jsonb_build_object(
        'is_start_hub', is_start_hub,
        'is_active', is_active,
        'status', status,
        'is_main_visit', is_main_visit,
        'hub_theme', hub_theme
      )
    )
WHERE id = 'eec26470-5202-4d52-a349-679843dae33b';

-- 2) Place des Ferblantiers: hub_theme à normaliser
UPDATE public.medina_pois SET
  hub_theme = 'artisans_metalwork',
  metadata = metadata
    || jsonb_build_object(
      'hub_promoted_at', now(),
      'hub_promotion_reason', 'lot1a_canonical_hub_stabilization',
      'hub_previous_state', jsonb_build_object(
        'is_start_hub', is_start_hub,
        'is_active', is_active,
        'status', status,
        'is_main_visit', is_main_visit,
        'hub_theme', hub_theme
      )
    )
WHERE id = '5e741c86-76a1-4a80-8bc7-77cad700adc9';

-- 3) Bab Agnaou: promotion
UPDATE public.medina_pois SET
  is_start_hub = true,
  is_main_visit = true,
  hub_theme = 'portes_historiques',
  status = 'validated',
  metadata = metadata
    || jsonb_build_object(
      'hub_promoted_at', now(),
      'hub_promotion_reason', 'lot1a_canonical_hub_stabilization',
      'hub_previous_state', jsonb_build_object(
        'is_start_hub', is_start_hub,
        'is_active', is_active,
        'status', status,
        'is_main_visit', is_main_visit,
        'hub_theme', hub_theme
      )
    )
WHERE id = '070503dd-9fe9-46a5-9839-5b54e937d743';

-- 4) Palais Bahia: promotion (manque is_start_hub + hub_theme)
UPDATE public.medina_pois SET
  is_start_hub = true,
  is_main_visit = true,
  hub_theme = 'palais_historiques',
  status = 'validated',
  metadata = metadata
    || jsonb_build_object(
      'hub_promoted_at', now(),
      'hub_promotion_reason', 'lot1a_canonical_hub_stabilization',
      'hub_previous_state', jsonb_build_object(
        'is_start_hub', is_start_hub,
        'is_active', is_active,
        'status', status,
        'is_main_visit', is_main_visit,
        'hub_theme', hub_theme
      )
    )
WHERE id = '2590a034-a580-4067-b2ab-646794f2381a';

-- 5) Jemaa el-Fna: réactivation de la seule fiche "place" existante
UPDATE public.medina_pois SET
  is_active = true,
  is_start_hub = true,
  is_main_visit = true,
  status = 'validated',
  hub_theme = 'places_emblematiques',
  metadata = metadata
    || jsonb_build_object(
      'hub_promoted_at', now(),
      'hub_promotion_reason', 'lot1a_canonical_hub_stabilization',
      'hub_previous_state', jsonb_build_object(
        'is_start_hub', is_start_hub,
        'is_active', is_active,
        'status', status,
        'is_main_visit', is_main_visit,
        'hub_theme', hub_theme
      ),
      'lot1a_debt', 'rename_to_Jemaa_el_Fna_canonical'
    )
WHERE id = '6d7f3e3f-9dfe-4877-9682-8e544068ea3f';