

## Plan : Marqueurs editables + sauvegarde auto manuelle

### Probleme

1. Les marqueurs dans la liste ne sont pas cliquables — impossible de modifier la note, la photo ou les coordonnees d'un marqueur existant
2. La saisie manuelle necessite de cliquer "Ajouter le marqueur" — pas d'auto-save

### Solution

#### 1. Mutation `updateMarker` dans `src/hooks/useRouteRecorder.ts`

Ajouter une mutation pour mettre a jour un marqueur existant :
- Accepte `markerId`, `lat`, `lng`, `note`, `photoUrl`, `audioUrl`
- Met a jour la ligne dans `route_markers`
- Invalide le cache des marqueurs
- Reconstruit le GeoJSON de la trace apres modification des coordonnees

#### 2. Dialog d'edition dans `src/components/intake/RouteReconStep.tsx`

Quand on clique sur un marqueur dans la liste :
- Ouvrir un Dialog pre-rempli avec les donnees du marqueur (lat, lng, note, photo, audio)
- Champs editables : latitude, longitude, note (textarea), photo (upload ou remplacement), audio (lecteur si existant)
- Bouton "Enregistrer" pour sauvegarder les modifications
- Bouton "Supprimer" (existant, deplace dans le dialog)

Les marqueurs dans la liste deviennent cliquables (curseur pointer, hover effect).

#### 3. Auto-save de la saisie manuelle

Modifier le formulaire de saisie manuelle pour sauvegarder automatiquement :
- Des que lat + lng sont remplis ET qu'une photo est uploadee : auto-save
- Bouton "Valider sans photo" renomme en "Ajouter" (reste present pour les cas sans photo)
- Apres sauvegarde : formulaire se vide avec feedback visuel (check vert bref)

### Resume des changements

| Fichier | Changement |
|---------|------------|
| `src/hooks/useRouteRecorder.ts` | Ajouter mutation `updateMarker` |
| `src/components/intake/RouteReconStep.tsx` | Dialog edition marqueur + clic sur marqueur + auto-save manuel |
