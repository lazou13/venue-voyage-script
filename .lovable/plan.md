

## Ajouter l'action `enrich_poi` au n8n-proxy

### Résumé
Ajouter un nouveau bloc `if (action === "enrich_poi")` dans `supabase/functions/n8n-proxy/index.ts` qui utilise Lovable AI (Gemini) pour générer du contenu narratif trilingue pour les POIs prêts à être enrichis.

### Logique

1. **Fetch** : Sélectionner 5 POIs de `medina_pois` où `enrichment_status = 'wikidata_done'` ET `story_fr IS NULL`, triés par `poi_quality_score` desc.

2. **Pour chaque POI** : Appeler `https://ai.gateway.lovable.dev/v1/chat/completions` (Gemini 2.5 Flash) avec un prompt structuré demandant :
   - `story_fr` (200-300 mots) — récit immersif en français
   - `story_en` (200-300 mots) — traduction naturelle
   - `story_ar` (150-250 mots) — version arabe
   - `fun_facts` (tableau de 2-3 faits surprenants, JSON)
   - `visitor_tips` (tableau de 2-3 conseils pratiques, JSON)

3. **Update** : Mettre à jour chaque POI avec les champs générés + `enrichment_status = 'content_done'`.

4. **Retour** : `{ ok: true, enriched: N, skipped: M }`.

### Détails techniques

- Utilise `LOVABLE_API_KEY` (déjà disponible en secret) via le gateway Lovable AI — pas besoin de clé supplémentaire.
- Le prompt utilise tool calling (structured output) pour garantir un JSON valide sans parsing fragile.
- Délai de 1.5s entre chaque appel pour éviter le rate-limiting.
- Mise à jour de la liste `available` actions dans le fallback 400.

### Fichier modifié
- `supabase/functions/n8n-proxy/index.ts` — ajout du bloc `enrich_poi` (~80 lignes)

