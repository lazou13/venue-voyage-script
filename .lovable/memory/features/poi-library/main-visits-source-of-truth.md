---
name: main-visits-source-of-truth
description: Règle canonique anti-doublon pour POIs principaux + hubs canoniques LOT 1A
type: feature
---

# Main Visits — source de vérité

`is_main_visit=true` identifie les POIs majeurs visitables exposés via `api-v2?route=main-visits`.

## Règle d'unicité
Un seul POI canonique par lieu emblématique doit porter `is_main_visit=true AND is_active=true`.
Les doublons existants (Koutoubia, Bahia, etc.) sont à fusionner hors LOT 1.

## Hubs canoniques (LOT 1A appliqué)
5 hubs garantis `is_main_visit=true AND is_start_hub=true AND is_active=true AND status='validated'` avec `hub_theme` normalisé. Voir [start-hubs](mem://features/poi-library/start-hubs).

## Garde-fou recatégorisation
La recatégorisation pilote LOT 1A **bloque toute mutation** sur un POI portant `is_start_hub=true` ou `is_main_visit=true`. Garde-fou actif côté UI (`RecatPilotPanel.tsx`).

## Anomalie historique
La requête `category='restaurant' AND is_main_visit=true` retourne 0 au 2026-04-21. Critère de sortie LOT 1A satisfait sans mutation.
