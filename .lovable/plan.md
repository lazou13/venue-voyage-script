

# Plan : Servir le contenu enrichi Perplexity dans generate-quest

## Constat

Les 451 POIs sont enrichis en base avec des contenus longs (history_context 246 mots, anecdotes 139 mots, fun facts). Mais `generate-quest` ne sélectionne **que** les anciens champs courts (`history_context`, `local_anecdote`). Les champs Perplexity (`local_anecdote_fr/en`, `fun_fact_fr/en`, `wikipedia_summary`) sont ignorés.

**Note** : le champ `history_context` dans `medina_pois` contient **déjà** le contenu long de 200+ mots (écrit par Perplexity directement dedans). Donc l'histoire est déjà servie. Ce qui manque, ce sont les anecdotes multilingues et les fun facts.

## Modifications

### 1. `generate-quest/index.ts` — SELECT + mapping enrichi

- Ajouter au SELECT : `local_anecdote_fr, local_anecdote_en, fun_fact_fr, fun_fact_en, wikipedia_summary`
- Mapping avec fallback selon la langue :
  - `local_anecdote` : `local_anecdote_fr || local_anecdote` (FR), `local_anecdote_en || local_anecdote` (EN)
  - Nouveaux champs : `fun_fact_fr`, `fun_fact_en`, `wikipedia_summary`

### 2. `QuestEngine.ts` — Type POI + Stop + mapping

- Ajouter au type `POI` : `local_anecdote_fr`, `local_anecdote_en`, `fun_fact_fr`, `fun_fact_en`, `wikipedia_summary`
- Ajouter au type `Stop` : `fun_fact?: string`
- Dans la construction des stops (guided_tour, ~L591) :
  - `local_anecdote` : choisir la version longue selon `input.language`
  - `fun_fact` : choisir `fun_fact_fr` ou `fun_fact_en` selon la langue
  - `history_context` : enrichir avec `wikipedia_summary` si `history_context` est court (<100 chars)

### 3. `useQuestEngine.ts` — Type Stop

- Ajouter `fun_fact?: string` au type `Stop`

### 4. `QuestResult.tsx` — Affichage fun_fact

- Ajouter un bloc entre l'anecdote et les infos pratiques :
```
💡 Le saviez-vous ? {stop.fun_fact}
```
Style : fond amber-50, bordure amber-200 (similaire au bloc histoire)

### 5. Redéployer `generate-quest`

## Fichiers modifiés

| Fichier | Changement |
|---|---|
| `supabase/functions/generate-quest/index.ts` | SELECT + mapping enrichi avec fallback langue |
| `supabase/functions/generate-quest/QuestEngine.ts` | Types POI/Stop + logique fun_fact |
| `src/hooks/useQuestEngine.ts` | Type Stop + fun_fact |
| `src/components/quest/QuestResult.tsx` | Bloc "Le saviez-vous ?" |

