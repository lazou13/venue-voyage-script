

## Générer les Fun Facts pour 998 POIs

### Constat
- **47 POIs** ont `fun_fact_fr` / `fun_fact_en` (enrichis via `anecdote-enricher`)
- **998 POIs** ont `local_anecdote_fr` mais **pas** de `fun_fact_fr`
- La colonne JSONB `fun_facts` est toujours `[]` — les vrais fun facts sont dans `fun_fact_fr` / `fun_fact_en` (colonnes texte)

### Plan

Ajouter une action `generate_fun_facts` dans `supabase/functions/n8n-proxy/index.ts` :

1. **Fetch** N POIs (défaut 5) avec `fun_fact_fr IS NULL AND local_anecdote_fr IS NOT NULL`
2. **Pour chaque POI**, appeler Gemini 2.5 Flash avec tool calling :
   - Contexte : `name`, `category`, `local_anecdote_fr`, `history_context`, `wikipedia_summary`
   - Générer `fun_fact_fr` (1 phrase percutante, fait surprenant vérifiable, 20-40 mots) et `fun_fact_en` (traduction)
3. **Update** `fun_fact_fr` + `fun_fact_en` sur chaque POI
4. **Retourner** `{ ok: true, generated: N, total_remaining: M }`

**Payload n8n** : `{"action": "generate_fun_facts", "batch_size": 5}`

Boucler jusqu'à `generated = 0`.

### Détails techniques
- Prompt contraint : "Un seul fait surprenant, vérifiable, en une phrase. Pas de 'Saviez-vous que'. Pas d'introduction."
- Délai 1.5s entre POIs
- Gestion 429/402
- ~70 lignes ajoutées dans `n8n-proxy/index.ts`

### Fichier modifié
- `supabase/functions/n8n-proxy/index.ts`

