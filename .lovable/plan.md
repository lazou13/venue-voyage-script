# Unifier la génération de visites + filtre audio global

## Problème de fond
Deux moteurs coexistent :

| Moteur | Fichier | Géo | Audio | Utilisé par |
|---|---|---|---|---|
| **Sur-mesure** (sérieux) | `generate-quest/QuestEngine.ts` (1211 l.) | NN + 2-opt + diversité ✓ | **absent** ✗ | joueurs via `public-generate-quest` |
| **Rebuild** (ad-hoc, créé hier) | `quest-library-rebuild/index.ts` | LLM libre ✗ | filtre cassé ✗ | bouton admin |

→ Patcher seulement `rebuild` laisse la génération sur-mesure casser dès qu'un joueur tombe sur un POI sans audio. C'est ce que tu pointes.

## Stratégie : un seul moteur, deux entrées

### 1. Ajouter `require_audio_fr` à QuestEngine
Dans `QuestEngine.ts`, étape « Filter candidates » :

```ts
if (input.require_audio_fr) {
  if (!p.audio_url_fr || p.audio_url_fr.trim().length < 10) return false;
}
```

et même check dans le bloc « complément culturel ».

Ajouter le champ à `EngineInput` (`require_audio_fr?: boolean`).

### 2. `public-generate-quest` passe systématiquement `require_audio_fr: true`
Toute visite jouée doit avoir des audios. Si pas assez de POIs avec audio dans le rayon → message clair plutôt qu'un POI muet.

### 3. Remplacer `quest-library-rebuild` par un wrapper qui appelle `QuestEngine`
Le bouton « Reconstruire » devient un orchestrateur : pour chaque (hub × thème), il appelle directement `generateQuest()` (import depuis `_shared` ou via le edge `generate-quest`), avec :
- `start_lat/lng` = hub
- `theme` = complete | hidden_gems | photography
- `mode = "guided_tour"`
- `require_audio_fr = true`
- `radius_m = 1200`
- `max_stops = 8`
- `max_duration_min = 180`
- exclusion food déjà gérée par `EXCLUDED_CATEGORIES` du moteur

Le LLM n'est **plus consulté** pour choisir les POIs ni leur ordre. Il sert uniquement à générer **titre + description + highlights** une fois la route déterminée (étape narrative existante de `public-generate-quest`).

### 4. Supprimer la logique IA-libre dupliquée
On supprime de `quest-library-rebuild/index.ts` : le prompt Gemini de sélection, le tool `create_visit`, la boucle `usedAcrossThemes`. Garde uniquement : purge + boucle `for hub for theme → generateQuest()` + appel narratif court + insert.

### 5. Migration douce
- `QuestEngine` reste rétrocompatible (`require_audio_fr` default `false`).
- Activé `true` dans `public-generate-quest` (joueurs) ET dans le nouveau rebuild.
- Si on veut un mode admin permissif un jour, il suffit de passer `false`.

## QA après
- `SELECT count(*) FROM quest_library ql, jsonb_array_elements(stops_data) s LEFT JOIN medina_pois mp ON mp.id = (s->>'poi_id')::uuid WHERE coalesce(mp.audio_url_fr,'') = '';` → doit retourner 0.
- Pour chaque visite : segment max ≤ 2× médiane (déjà géré par 2-opt).
- Test manuel : générer une visite sur mesure depuis le player → vérifier qu'aucun POI muet n'apparaît.

## Périmètre fichiers
- **Modif** `supabase/functions/generate-quest/QuestEngine.ts` : ajouter champ + 2 filtres audio (~10 lignes).
- **Modif** `supabase/functions/public-generate-quest/index.ts` : passer `require_audio_fr: true` à l'engine.
- **Réécriture courte** `supabase/functions/quest-library-rebuild/index.ts` : ~150 lignes au lieu de 350, appelle `generateQuest()`.
- **Aucun** changement DB, UI, schema, player, API publique.

## Hors-scope
- Pas de modif des POIs ni des audios.
- Pas de TTS, pas de pipeline d'enrichissement.
- Pas de nouvelle table, pas de migration.
- Pas de changement de modèle IA.
