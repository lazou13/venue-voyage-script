

# Fix: Agent trop lent + Score des riads trop bas

## Diagnostic

### Pourquoi l'agent semble arrêté
L'agent n'est **pas arrêté** — il fonctionne mais est trop lent : **15 POIs par heure**. Avec 830 POIs restants, il faudrait **55 heures** pour tout traiter. Il a bien enrichi 30 POIs (2 cycles) et généré 4 visites.

### Score des riads
Score moyen actuel des riads : **5.2/10**. Les riads de la médina sont des maisons traditionnelles avec patios, architecture mauresque, zellige — ils ont une forte valeur patrimoniale et touristique et méritent un score plus élevé.

## Solution

### 1. Accélérer l'agent (poi-auto-agent)
- Passer de **15 à 50 POIs** par appel IA (Gemini Flash gère facilement)
- Ajouter un **mode turbo** : quand appelé manuellement, boucler 3 fois dans le même appel (150 POIs)
- Réduire le temps de couverture de 55h à ~6h

### 2. Augmenter le score des riads dans le classify-worker
Modifier le prompt de scoring dans `poi-classify-worker` :
- Ajouter une règle : **"Les riads de la médina sont du patrimoine architectural vivant. Score minimum 6, et 7-8 si bien noté ou connu"**
- Justification : un riad n'est pas un simple hôtel, c'est une maison traditionnelle marocaine avec architecture historique

### 3. Reclassifier les riads existants
Ajouter un bouton "Re-scorer les riads" dans le pipeline qui :
- Reset `poi_quality_score` uniquement pour les POIs `category_ai = 'riad'`
- Relance la classification sur ces 55 POIs avec le prompt amélioré

## Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/poi-auto-agent/index.ts` | Batch 50, mode turbo (3 boucles si manuel) |
| `supabase/functions/poi-classify-worker/index.ts` | Ajout règle riads score ≥ 6 dans le prompt |
| `src/pages/admin/AdminPOIPipeline.tsx` | Bouton "Re-scorer riads" |

