

# Plan : Bibliothèque Photos Terrain

## Objectif
Créer une page admin "Médiathèque" qui agrège toutes les photos prises pendant les repérages (depuis `route_markers`) avec possibilité de filtrer, taguer, télécharger individuellement ou en lot pour réutilisation sur les réseaux sociaux.

## Architecture

Les photos existent déjà dans le bucket `fieldwork` (public), référencées par `route_markers.photo_url` et `route_markers.photo_urls[]`. Pas besoin de nouvelle table ni de copie de fichiers. On construit une vue agrégée par-dessus les données existantes.

## Modifications

### 1. Nouvelle page `src/pages/admin/AdminMediaLibrary.tsx`
- Requête toutes les `route_markers` avec photos (join sur `route_traces` pour le nom de trace et `project_id`)
- Grille de photos responsive (masonry-like, 3-4 colonnes)
- Chaque photo affiche : miniature, coordonnées GPS, note du marqueur, date, nom de trace
- Filtres : par projet, par trace, par date
- Sélection multiple (checkboxes) pour téléchargement en lot (ZIP via JSZip, déjà installé)
- Bouton télécharger individuellement
- Clic sur photo ouvre le `PhotoLightbox` existant
- Compteur total de photos

### 2. Route et navigation
- Ajouter la route `/admin/media-library` dans `App.tsx`
- Ajouter l'entrée "Médiathèque" dans `AdminSidebar.tsx` avec l'icône `Camera`

### 3. Pas de migration SQL
- Les données viennent de `route_markers` + `route_traces` existants
- Le bucket `fieldwork` est déjà public

## Fichiers impactés
- `src/pages/admin/AdminMediaLibrary.tsx` (nouveau)
- `src/App.tsx` (ajout route)
- `src/components/admin/AdminSidebar.tsx` (ajout lien)

