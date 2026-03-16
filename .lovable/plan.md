

## Plan : Mode Bibliothèque — Carte interactive Leaflet + nettoyage des sections inutiles

### Problème
Le projet "Bibliothèque" affiche actuellement toutes les sections de RouteReconStep (type de parcours, segments, danger, arrêts, sécurité) qui ne sont pas pertinentes. Il manque aussi une carte interactive pour visualiser les POIs en temps réel.

### Solution

**Fichier unique : `src/components/intake/RouteReconStep.tsx`**

1. **Détecter le mode bibliothèque** : Lire `questConfig.project_type` et créer un booléen `isLibraryMode = projectType === 'library'`.

2. **Masquer les sections non pertinentes** : Wrapper les 5 `OptionMatrix` (Type de parcours, Segments, Danger, Arrêts, Sécurité) avec `{!isLibraryMode && (...)}`. Masquer aussi la section "Dupliquer en projet", le bandeau Guidage, et le CrossTabSummary qui n'ont pas de sens pour la bibliothèque.

3. **Ajouter une carte Leaflet interactive** : Remplacer le placeholder SVG actuel par une vraie carte Leaflet (déjà en dépendance dans le projet via `react-leaflet`). La carte affiche :
   - La trace GPS en polyline bleue (temps réel pendant l'enregistrement)
   - Les marqueurs en tant que `CircleMarker` cliquables avec popup (note + miniature photo)
   - La position actuelle de l'utilisateur avec un point pulsant
   - Auto-centrage sur les bounds des données (trace + marqueurs)
   - Cette carte est visible pour **tous les types de projet**, pas seulement bibliothèque — elle remplace l'aperçu SVG simplifié existant

4. **Suggestions UX supplémentaires pour le mode bibliothèque** :
   - Afficher un compteur prominent "X POIs collectés" en haut
   - Ajouter un bouton "📤 Tout promouvoir" pour envoyer tous les marqueurs non-promus vers la bibliothèque en masse

### Rendu visuel attendu
- Mode bibliothèque : Enregistreur GPS + carte interactive + liste de marqueurs + actions de promotion. Rien d'autre.
- Mode parcours classique : Comportement inchangé (carte Leaflet remplace juste le SVG).

