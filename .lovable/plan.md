

## Plan : Compte-rendu IA visible sous chaque marqueur de trace

### Objectif
Afficher le compte-rendu de l'analyse IA directement sous chaque marqueur dans la liste des traces enregistrées, avec possibilité de **corriger** (éditer la note) ou **approuver** (appliquer l'analyse).

### Problème actuel
L'analyse IA n'est visible que dans le drawer "marqueur rapide" pendant l'enregistrement. Une fois fermé, le résultat n'est plus accessible sauf s'il a été appliqué à la note.

### Approche

**1. Bouton "Analyser IA" par marqueur dans la liste**
Dans la liste des marqueurs sous chaque trace (lignes 1406-1476), ajouter pour chaque marqueur :
- Un bouton 🧠 "Analyser" qui déclenche `analyze-marker` pour ce marqueur spécifique (photo_url, audio_url, lat, lng, note)
- Un état `markerAnalyses: Record<string, any>` pour stocker les résultats par marker ID
- Un état `analyzingMarkerId: string | null` pour le spinner

**2. Panel de compte-rendu sous chaque marqueur**
Quand l'analyse est disponible pour un marqueur, afficher un panel dépliable sous le marqueur contenant :
- Lieu identifié, catégorie
- Anecdote historique
- Description guide (fr)
- Restaurants proches
- Spot Instagram (score, angle, hashtags)
- Transcription audio si présente
- Énigme générée

**3. Actions Corriger / Approuver**
Deux boutons en bas du panel :
- **✅ Approuver** : applique l'analyse complète à la note du marqueur via `updateMarker` (même logique que `handleApplyAiAnalysis` mais ciblé sur le marqueur concerné)
- **✏️ Corriger** : ouvre le dialogue d'édition du marqueur (`handleOpenEditMarker`) avec la note pré-remplie par l'analyse, permettant de modifier avant de sauvegarder

**4. Auto-analyse au clic sur la trace**
Quand on sélectionne une trace et que ses marqueurs se chargent, proposer un bouton "🧠 Analyser tous les marqueurs" qui lance l'analyse en série pour chaque marqueur ayant une photo ou un audio mais pas encore de note enrichie (pas de préfixe 📍).

### Fichiers modifiés

**`src/components/intake/RouteReconStep.tsx`**
- Ajouter les états `markerAnalyses` et `analyzingMarkerId`
- Créer une fonction `triggerMarkerAnalysis(marker)` qui appelle l'edge function pour un marqueur donné
- Dans le rendu de chaque marqueur (lignes 1407-1474), ajouter le bouton 🧠 et le panel de résultat
- Ajouter les handlers `handleApproveMarkerAnalysis(markerId)` et `handleCorrectMarkerAnalysis(markerId)`
- Ajouter un bouton "Analyser tous" dans le header des marqueurs (ligne 1262)

