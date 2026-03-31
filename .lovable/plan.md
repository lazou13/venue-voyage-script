

# Fix: Classification IA — mauvais scores et categorisation

## Diagnostic

Apres analyse de la base :

- **Scores trop bas** : les galleries plafonnent a 5/10, les monuments connus (Tombeaux Saadiens) a 6/10, des restaurants populaires (594 avis, 4.1★) a 1.5/10
- **Scores = copie du rating Google** : l'IA recopie le rating Google au lieu d'evaluer l'interet touristique reel
- **Modele trop faible** : `gemini-2.5-flash-lite` (le moins performant) n'a pas assez de capacite de raisonnement pour cette tache

## Solution

### 1. Upgrader le modele et le prompt (`poi-classify-worker/index.ts`)

| Changement | Detail |
|-----------|--------|
| Modele | `gemini-2.5-flash-lite` → `gemini-2.5-flash` (meilleur raisonnement) |
| System prompt | Ajouter un **rubrique de scoring explicite** avec exemples concrets |
| User prompt | Inclure `reviews_count` et les types Google pour un meilleur contexte |

**Rubrique de scoring a ajouter :**
```
Score 9-10 : Monument iconique, incontournable (Koutoubia, Bahia, Ben Youssef)
Score 7-8 : Lieu tres interessant, forte valeur culturelle ou experience unique
Score 5-6 : Lieu agreable, bon complement d'itineraire
Score 3-4 : Lieu ordinaire ou peu distinctif
Score 1-2 : Peu d'interet touristique, generique
Le score NE DOIT PAS etre une copie du rating Google. Un restaurant 5★ avec 3 avis = score 3. Un monument 3.9★ avec 14000 avis = score 8+.
```

### 2. Reset les POIs mal classifies pour re-classification

Ajouter un bouton "Re-classifier" dans le dashboard qui remet `category_ai = NULL` et `poi_quality_score = NULL` sur les POIs concernes, permettant au classify-worker de les retraiter.

### 3. Auto-loop pour le classify worker (`AdminPOIPipeline.tsx`)

Meme pattern que le backfill : le classify-worker boucle automatiquement par batch de 20 jusqu'a ce qu'il n'y ait plus de POIs a classifier.

## Fichiers modifies

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/poi-classify-worker/index.ts` | Modele → `gemini-2.5-flash`, prompt avec rubrique de scoring |
| `src/pages/admin/AdminPOIPipeline.tsx` | Bouton "Re-classifier" + auto-loop pour classify |

