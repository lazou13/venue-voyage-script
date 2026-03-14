

## Plan : Vue plein écran pour le détail d'un marqueur avec édition IA

### Problème actuel
Cliquer sur la ligne d'un marqueur ouvre le petit dialog "Modifier le marqueur" (screenshot 2) — trop étroit pour relire l'analyse IA, la corriger, ou l'enrichir. Pas de bouton "Approuver + Bibliothèque" dans ce dialog.

### Solution
Remplacer le comportement du clic sur la ligne du marqueur : au lieu d'ouvrir le petit `Dialog`, ouvrir une **vue plein écran** (Sheet ou Dialog `max-w-4xl`) avec tout le contenu du marqueur.

### Structure de la nouvelle vue "MarkerDetailSheet"

**Panneau gauche (ou haut sur mobile)** — Infos du marqueur :
- Coordonnées GPS (éditables)
- Photo (avec lightbox + changement)
- Audio (lecture + changement)
- Bouton "Ma position GPS"

**Panneau principal** — Contenu IA :
- Si analyse IA disponible : affichage complet (lieu, catégorie, guide narration, anecdote, restaurants avec liens/avis, POIs avec billets, Instagram)
- Chaque section est un `Textarea` éditable (pas juste du texte) → l'utilisateur peut corriger directement
- Bouton "🧠 Enrichir avec l'IA" qui relance `triggerMarkerAnalysis` sur ce marqueur
- Bouton "🧠 Demander à l'IA de modifier" qui ouvre un champ de prompt libre → appelle `analyze-marker` avec une instruction de correction

**Footer** — Actions :
- "Enregistrer" → sauve les modifications (note enrichie + coords + photo)
- "✅ Approuver + Bibliothèque" → `handleApproveAndPromote`
- "Supprimer" (destructive)
- "Fermer"

### Modifications techniques

**Fichier unique : `src/components/intake/RouteReconStep.tsx`**

1. **Nouvel état** : `detailMarkerId: string | null` (remplace le rôle de `editingMarker` pour le clic ligne)
2. **Clic ligne** (l.1519) : `onClick={() => setDetailMarkerId(marker.id)}` au lieu de `handleOpenEditMarker`
3. **Nouveau composant inline `MarkerDetailSheet`** : utilise `<Dialog>` avec `className="max-w-4xl max-h-[90vh]"` contenant :
   - Grille 2 colonnes : gauche = coords/photo/audio, droite = contenu IA éditable
   - Textarea pour la note/narration (pré-remplie avec l'analyse IA si dispo)
   - Textarea pour chaque section IA (guide, anecdote, restaurants)
   - Bouton "Enrichir IA" et "Approuver + Bibliothèque" dans le footer
4. **Le petit dialog "Modifier le marqueur" reste** accessible via un bouton "Modifier coords" dans la vue détail (pour ne rien casser)

### Flux utilisateur final
1. Clic sur la ligne du marqueur → vue plein écran s'ouvre
2. L'utilisateur voit tout : photo, analyse IA complète, liens, avis
3. Il peut corriger le texte directement dans les champs
4. Il peut cliquer "🧠 Enrichir" pour relancer l'IA
5. Il clique "Enregistrer" ou "✅ Approuver + Bibliothèque"

