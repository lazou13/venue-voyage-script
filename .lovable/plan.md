

## Traduction batch des POIs en anglais via n8n-proxy

### Contexte
- **1008 POIs** ont `local_anecdote_fr` sans traduction anglaise
- **1055 POIs** ont `history_context` (en français) sans équivalent anglais
- **47 POIs** ont déjà `fun_fact_fr` + `fun_fact_en`
- **0 POIs** ont `story_en`

### Plan

Ajouter une action `translate_pois` dans `supabase/functions/n8n-proxy/index.ts` qui :

1. **Fetch** 5 POIs avec `local_anecdote_fr IS NOT NULL AND local_anecdote_en IS NULL`
2. **Pour chaque POI**, envoyer un seul appel Gemini 2.5 Flash avec tool calling pour traduire en batch tous les champs FR disponibles :
   - `local_anecdote_fr` → `local_anecdote_en`
   - `fun_fact_fr` → `fun_fact_en`  
   - `history_context` → `history_context_en` (nouveau champ, ou on stocke dans `description_short` en anglais)
   - `name` → `name_en`
3. **Update** chaque POI avec les traductions
4. **Retourner** `{ ok: true, translated: N }`

**Payload n8n** : `{"action": "translate_pois", "batch_size": 5}`

Appeler en boucle depuis n8n jusqu'à ce que `translated = 0`.

### Détails techniques
- Un seul appel AI par POI (concatène tous les champs FR dans le prompt, structured output via tool calling)
- Délai 1.5s entre POIs pour éviter le rate-limiting
- Utilise `LOVABLE_API_KEY` déjà configuré
- Pas de nouvelle migration nécessaire (les colonnes `local_anecdote_en`, `fun_fact_en`, `name_en` existent déjà)

### Fichier modifié
- `supabase/functions/n8n-proxy/index.ts` — ajout du bloc `translate_pois` (~70 lignes)

