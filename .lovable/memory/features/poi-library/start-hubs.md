---
name: start-hubs
description: Liste des hubs canoniques de départ pour génération de visites médina + thèmes normalisés
type: feature
---

# Start Hubs canoniques (médina Marrakech) — LOT 1A appliqué

5 hubs stables sont marqués `is_start_hub=true AND is_main_visit=true AND status='validated'` :

| Hub | id | hub_theme |
|---|---|---|
| Mosquée Koutoubia | `eec26470-5202-4d52-a349-679843dae33b` | `monuments_historiques` |
| Place des Ferblantiers | `5e741c86-76a1-4a80-8bc7-77cad700adc9` | `artisans_metalwork` |
| Bab Agnaou | `070503dd-9fe9-46a5-9839-5b54e937d743` | `portes_historiques` |
| Palais Bahia | `2590a034-a580-4067-b2ab-646794f2381a` | `palais_historiques` |
| Jemaa el-Fna (fiche `jem3 elfna`) | `6d7f3e3f-9dfe-4877-9682-8e544068ea3f` | `places_emblematiques` |

Valeurs `hub_theme` normalisées : `monuments_historiques`, `places_emblematiques`, `artisans_metalwork`, `portes_historiques`, `palais_historiques`.

Toute mutation porte `metadata.hub_promoted_at`, `metadata.hub_promotion_reason='lot1a_canonical_hub_stabilization'`, `metadata.hub_previous_state` (snapshot).

Dette : la fiche Jemaa el-Fna doit être renommée (`metadata.lot1a_debt='rename_to_Jemaa_el_Fna_canonical'`). Doublons Koutoubia (14) et Bahia (≥2) non fusionnés en 1A.
