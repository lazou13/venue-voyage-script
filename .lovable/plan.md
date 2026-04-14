

## Plan : Barre de progression et résultat par action

### Problème actuel
Les actions manuelles sont en grille sans indication de progression individuelle ni résultat final. La barre de progression globale `extractionProgress` n'est utilisée que par certaines étapes.

### Modifications

**Fichier unique : `src/pages/admin/AdminPOIPipeline.tsx`**

1. **Nouveau state `stepResult`** — Un `Record<StepKey, { processed: number; total?: number; progress: number }>` pour stocker la progression et le résultat de chaque action individuellement.

2. **Mise à jour des auto-loops** — Dans chaque branche de `runStep()` (fun-facts, translate-en, fetch-photos, classify, backfill-details, extract), mettre à jour `stepResult[step]` avec le nombre traité et le pourcentage de progression à chaque itération.

3. **Layout vertical avec barre de progression inline** — Remplacer la grille `grid-cols-2 md:grid-cols-4` par une liste verticale `flex flex-col gap-2`. Chaque action devient une ligne contenant :
   - Le bouton (largeur fixe ~200px)
   - Une description courte du rôle (`text-sm text-muted-foreground`)
   - Si `stepResult[step]` existe : une mini `<Progress>` (largeur ~120px) + le compteur `X traités`

4. **Résultat final persistant** — Quand une étape se termine, `stepResult[step]` reste affiché avec une icône ✓ verte et le total traité, jusqu'au prochain lancement.

5. **Ordre d'exécution logique** des boutons :
   - Extraire → Classifier → Enrichir → Nettoyer → Fusionner → Proximité → Backfill → Photos → Anecdotes → Traduire EN → Re-classifier → Re-scorer → Autopipeline → Rafraîchir

### Rendu visuel attendu

```text
[Extraire        ] Extrait les POIs depuis OpenStreetMap          ✓ 842 importés
[Classifier      ] Classifie par catégorie IA                    [████░░] 120/200
[Enrichir        ] Enrichit descriptions et métadonnées
[Nettoyer        ] Supprime doublons et POIs faible qualité
...
```

