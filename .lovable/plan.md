

# Plan : Auto-validation des POIs par l'agent autonome

## Constat

- **815 POIs enrichis**, **0 validés**
- L'API publique (`mode=library`) filtre sur `status = 'validated'` → QR Pro reçoit **0 POIs**
- L'agent `poi-auto-agent` n'a **aucune phase de validation** — il enrichit et génère des visites, mais ne promeut jamais les POIs au statut "validated"
- **765 POIs** remplissent déjà les critères de validation (enrichis, score ≥ 3, catégorie IA, coordonnées GPS)

## Solution

Ajouter une **Phase 0 "Auto-Validation"** dans `poi-auto-agent` qui s'exécute en premier à chaque cycle. Elle promeut automatiquement les POIs enrichis éligibles vers le statut `validated`.

### Critères d'éligibilité (déjà établis dans le système)
- `status = 'enriched'`
- `is_active = true`
- `poi_quality_score >= 3`
- `category_ai IS NOT NULL`
- `lat IS NOT NULL AND lng IS NOT NULL`
- `name IS NOT NULL`

### Modifications

**Fichier : `supabase/functions/poi-auto-agent/index.ts`**

Ajouter une Phase 0 avant la Phase 1 existante :
1. Requête : sélectionner les POIs `enriched` + éligibles (batch de 200)
2. Mettre à jour leur `status` à `validated` et `validated_at` à `now()`
3. Logger le nombre de POIs validés

Le reste de l'agent (Phase 1 enrichissement tags, Phase 2 génération visites) reste inchangé.

### Résultat attendu

- Premier cycle de l'agent : **~765 POIs passent en "validated"** immédiatement
- L'API `mode=library` retourne ces 765+ POIs à QR Pro
- Le dashboard affiche les vrais chiffres de POIs validés
- Chaque futur cycle auto-valide les nouveaux POIs enrichis

### Fichiers modifiés

| Fichier | Changement |
|---|---|
| `supabase/functions/poi-auto-agent/index.ts` | Ajout Phase 0 auto-validation |

