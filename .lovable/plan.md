

## Plan : Saisie manuelle des marqueurs GPS

### Probleme

Les traces enregistrees automatiquement sont melangees et inutilisables. L'utilisateur a besoin d'un moyen de creer des marqueurs manuellement en entrant les coordonnees GPS et en ajoutant des photos.

### Solution

Ajouter une section "Marqueurs manuels" dans l'onglet Parcours, permettant de :
- Creer une trace "manuelle" dediee (ou reutiliser une existante)
- Ajouter des marqueurs un par un avec latitude, longitude, note et photo
- Modifier ou supprimer des marqueurs existants

### Fichier a modifier

**`src/components/intake/RouteReconStep.tsx`**

Ajouter une nouvelle section apres les traces enregistrees, avec :

1. **Bouton "Ajouter un point manuellement"** qui ouvre un formulaire inline avec :
   - Champ Latitude (number, 6 decimales)
   - Champ Longitude (number, 6 decimales)
   - Champ Note (texte, optionnel)
   - Bouton photo (upload vers le bucket fieldwork, comme les marqueurs rapides)
   - Bouton "Ajouter" qui sauvegarde le marqueur

2. **Logique** :
   - Si aucune trace n'existe, creer automatiquement une trace "manuelle" (nom = "Saisie manuelle") avec une geojson LineString vide
   - Si une trace est selectionnee, ajouter le marqueur a cette trace et mettre a jour la geojson avec les coordonnees
   - Apres ajout, mettre a jour la geojson de la trace pour inclure le nouveau point (pour que la validation fonctionne)

3. **Suppression de marqueurs individuels** : ajouter un bouton supprimer sur chaque marqueur dans la liste existante

**`src/hooks/useRouteRecorder.ts`**

- Ajouter une mutation `deleteMarker` pour supprimer un marqueur individuel de la base
- Ajouter une mutation `updateMarker` pour modifier les coordonnees/note/photo d'un marqueur existant
- Ajouter une mutation pour mettre a jour la geojson de la trace quand on ajoute un marqueur manuellement (recalculer les coordonnees a partir des marqueurs)

### Details techniques

**Formulaire de saisie manuelle :**
- Les champs lat/lng acceptent un nombre decimal (step="0.000001")
- Validation : latitude entre -90 et 90, longitude entre -180 et 180
- L'upload photo reutilise le hook `useFileUpload` existant
- Apres ajout, le formulaire se vide mais reste ouvert pour ajouter le suivant

**Mise a jour de la trace :**
- Quand un marqueur est ajoute manuellement, la geojson de la trace est reconstruite avec toutes les coordonnees des marqueurs de cette trace (dans l'ordre de creation)
- Cela garantit que la validation "min 2 points" fonctionne meme avec des marqueurs manuels

**Suppression de marqueurs :**
- Bouton poubelle sur chaque marqueur dans la liste
- Confirmation via AlertDialog
- Apres suppression, recalcul de la geojson de la trace

### Resume des changements

| Fichier | Changement |
|---------|------------|
| `src/hooks/useRouteRecorder.ts` | Mutations deleteMarker, updateMarker, recalcul geojson |
| `src/components/intake/RouteReconStep.tsx` | Section saisie manuelle + suppression marqueurs |

