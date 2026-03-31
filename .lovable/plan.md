

# Backfill ne produit plus — diagnostic et solution

## Diagnostic

Les chiffres actuels de la base :
- **616 POIs `raw`** (nouvelles extractions, pas encore classifiees/enrichies)
- **370 POIs `enriched`** avec `price_info` deja rempli
- **0 POIs eligibles** au backfill (filtre: `enrichment_status = 'enriched' AND price_info IS NULL`)

Le backfill ne trouve rien car les 616 nouveaux POIs sont encore au statut `raw`. Ils doivent d'abord passer par **classify → enrich** avant que le backfill puisse les traiter.

## Solution en 2 temps

### Etape 1 : Lancer le pipeline complet sur les 616 POIs `raw`
Depuis le dashboard, executer dans l'ordre :
1. **Classify** — attribue `category_ai` et `poi_quality_score`
2. **Enrich** (suite d'enrichissement) — passe le statut a `enriched`
3. **Backfill details** — remplira `price_info` sur les nouveaux POIs enrichis

### Etape 2 : Elargir le filtre du backfill (optionnel)
Modifier `poi-backfill-details` pour aussi cibler les POIs `raw` qui ont deja un `name` et des coordonnees, sans attendre l'enrichissement complet. Cela permettrait de backfiller en parallele.

**Changement dans `supabase/functions/poi-backfill-details/index.ts` :**
- Remplacer `.eq("enrichment_status", "enriched")` par `.in("enrichment_status", ["enriched", "raw"])`
- Garder le filtre `.is("price_info", null)`

Cela permettra au backfill de traiter les 616 POIs `raw` directement, sans attendre classify+enrich.

## Recommandation
L'option 2 est plus rapide : un seul changement d'une ligne dans la function, et le backfill traitera immediatement les 616 POIs restants.

| Fichier | Changement |
|---------|-----------|
| `supabase/functions/poi-backfill-details/index.ts` | Filtre `enrichment_status` : `"enriched"` → `["enriched", "raw"]` |

