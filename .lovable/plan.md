

## Plan : Ameliorer le Road Book

### 1. Remplacer le message narrateur par un resume

Actuellement, le Road Book reprend le texte complet de `story_i18n.fr` (qui est le message de presentation video du guide Amine). A la place, generer un court resume (2-3 phrases) sur le meme ton aventurier, en utilisant le titre, le theme, la ville et le nombre d'etapes. Le texte original de la video n'apparaitra plus dans le Road Book.

**Fichier : `src/lib/outputGenerators.ts`** (section `generateRoadBook`, lignes 844-849)

Remplacer l'insertion de `story` par un resume genere automatiquement du style :
"Partez a la decouverte de [ville] a travers un parcours de [N] etapes. Guidé par [narrateur], resolvez enigmes et defis pour accumuler un maximum de points. L'aventure commence maintenant !"

### 2. Utiliser les points configures (pas le defaut de 10)

Le probleme vient de `DUPLICATED_POI_DEFAULT_CONFIG` dans `mapMarkerToPOI.ts` qui force `points: 10` dans chaque step_config. Le Road Book utilise `stepScoring.points ?? pointsPerStep` - donc si le step a 10 en dur, il affiche 10 meme si le quest-level scoring est a 100.

**Fichier : `src/lib/outputGenerators.ts`** (ligne 952)

Modifier la logique pour prioriser le scoring quest-level quand le step scoring est le defaut (10) :
- Utiliser `pointsPerStep` (scoring global) comme reference principale
- Ne prendre le step scoring que s'il a ete explicitement personnalise

### 3. Decrire le genre d'enigme pour chaque etape

Actuellement chaque etape affiche juste "Enigme". Ajouter une description du type d'activite basee sur les validation modes et step types configures.

**Fichier : `src/lib/outputGenerators.ts`** (section parcours, lignes 947-966)

Pour chaque etape, generer une description lisible comme :
- QR Code -> "Trouvez et scannez le QR Code cache"
- Photo -> "Prenez une photo du lieu indique"  
- Code -> "Trouvez le code secret"
- Terrain -> "Defi terrain sur place"
- Manuel -> "Resolvez l'enigme et validez avec le guide"
- Enigme + QR -> "Resolvez l'enigme puis scannez le QR Code"

### 4. Ajouter une carte interactive avec les etapes

Ajouter un composant carte Leaflet dans l'onglet Road Book, au-dessus du textarea, affichant les marqueurs du parcours avec des labels "Etape 1", "Etape 2", etc.

**Fichier : `src/components/intake/OutputsStep.tsx`**

- Reutiliser les donnees `reportMarkers` deja chargees pour les projets route_recon
- Ajouter un petit composant `MapContainer` Leaflet (hauteur ~250px) au-dessus du textarea
- Chaque marqueur affiche un popup "Etape N - [nom du POI]"
- La carte s'ajuste automatiquement pour afficher tous les marqueurs (fitBounds)
- Si pas de marqueurs avec coordonnees, la carte n'apparait pas

### Resume des fichiers modifies

| Fichier | Changement |
|---------|------------|
| `src/lib/outputGenerators.ts` | Resume au lieu du texte complet, points corrects, description type enigme |
| `src/lib/mapMarkerToPOI.ts` | Retirer le scoring en dur (10 pts) pour heriter du scoring global |
| `src/components/intake/OutputsStep.tsx` | Carte Leaflet dans l'onglet Road Book |

