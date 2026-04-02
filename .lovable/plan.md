

# Enrichir l'affichage des visites guidees avec les donnees POI completes

## Probleme

Le moteur de quetes (`QuestEngine`) ne recupere pas les champs enrichis de `medina_pois` (price_info, opening_hours, must_see_details, etc.) et le composant d'affichage `GuidedContent` dans `QuestResult.tsx` n'affiche que story, history_context, local_anecdote, tourist_tips et photo_spot.

## Solution en 4 etapes

### Etape 1 — Backend: Ajouter les champs enrichis au QuestEngine

**Fichier**: `supabase/functions/generate-quest/QuestEngine.ts`

- Ajouter au type `POI`: `price_info`, `opening_hours`, `must_see_details`, `must_try`, `must_visit_nearby`, `is_photo_spot`, `photo_tip`, `ruelle_etroite`
- Ajouter au type `Stop`: les memes champs
- Dans `buildStops()`, mapper ces champs du POI vers le Stop en mode `guided_tour`

**Fichier**: `supabase/functions/generate-quest/index.ts`

- Ajouter les champs a la requete SELECT vers `medina_pois`
- Les mapper dans la construction de l'objet POI

### Etape 2 — Frontend: Enrichir le type Stop

**Fichier**: `src/hooks/useQuestEngine.ts`

Ajouter au type `Stop`:
```
price_info?: string | null
opening_hours?: Record<string, string> | null
must_see_details?: string | null
must_try?: string | null
must_visit_nearby?: string | null
is_photo_spot?: boolean
photo_tip?: string | null
ruelle_etroite?: boolean
```

### Etape 3 — Frontend: Enrichir le composant GuidedContent

**Fichier**: `src/components/quest/QuestResult.tsx`

Remplacer le composant `GuidedContent` pour ajouter apres les sections existantes:

1. **Infos pratiques** (collapsible) — tarif, horaires, details a ne pas manquer
2. **A voir** avec fallbacks par categorie (monument, souk, palais, etc.)
3. **A tester** — specialites culinaires si restaurant/cafe
4. **A visiter a proximite** — lieux proches recommandes
5. **Spot photo** — conseil photo avec icone camera
6. **Warning ruelle etroite** — alerte passages etroits

Chaque section conditionnelle, affichee uniquement si la donnee existe. Fallbacks par categorie en italique quand pas de details specifiques.

### Etape 4 — Deployer la edge function

Redeployer `generate-quest` pour que les nouvelles requetes incluent les champs enrichis.

## Fichiers modifies

| Fichier | Action |
|---------|--------|
| `supabase/functions/generate-quest/QuestEngine.ts` | Ajouter champs enrichis aux types POI et Stop + mapping dans buildStops |
| `supabase/functions/generate-quest/index.ts` | Ajouter champs au SELECT + mapping |
| `src/hooks/useQuestEngine.ts` | Ajouter champs enrichis au type Stop |
| `src/components/quest/QuestResult.tsx` | Enrichir GuidedContent avec sections collapsibles + fallbacks |

