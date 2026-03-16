

## Diagnostic

En cliquant sur un marqueur **sur la carte Leaflet**, seule une petite bulle (Popup) s'affiche avec un extrait tronqué de la note (100 caractères max) et une mini photo. La fiche détaillée complète (`MarkerDetailSheet`) ne s'ouvre **que** si on clique sur un marqueur dans la **liste textuelle** en dessous (après avoir sélectionné une trace).

Le composant `RouteReconMap` utilise des `CircleMarker` Leaflet avec des `Popup` natifs, mais aucun callback `onClick` n'est transmis pour ouvrir la fiche détaillée.

## Plan de correction

### 1. Ajouter un callback `onMarkerClick` à `RouteReconMap`

**Fichier : `src/components/intake/RouteReconMap.tsx`**
- Ajouter une prop `onMarkerClick?: (markerId: string) => void`
- Ajouter un `eventHandlers={{ click: () => onMarkerClick?.(marker.id) }}` sur chaque `CircleMarker`
- Garder le Popup comme aperçu rapide, mais le clic ouvrira aussi la fiche complète

### 2. Connecter le callback dans `RouteReconStep`

**Fichier : `src/components/intake/RouteReconStep.tsx`**
- Passer `onMarkerClick={(id) => setDetailMarkerId(id)}` au composant `RouteReconMap`
- Cela ouvrira la `MarkerDetailSheet` avec toutes les infos (coordonnées, photo, audio, note enrichie, actions IA)

Résultat : un clic sur un marqueur de la carte ouvre directement la fiche détaillée avec toutes les photos et informations.

