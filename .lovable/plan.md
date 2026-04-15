

## Plan : Corriger les erreurs de build TypeScript

### Contexte
HPP expose correctement les audio (22 POIs avec audio confirmé en DB, endpoint `public-project-data?mode=library` fonctionnel). Le problème audio est côté PRO (déjà corrigé par PRO). Les erreurs ci-dessous sont des problèmes TypeScript pré-existants à corriger.

### Erreurs à corriger

#### 1. `src/hooks/usePOIs.ts` (lignes 311-317)
**Problème** : L'insert dans la table `pois` référence des colonnes (`history_context`, `local_anecdote_fr`, etc.) qui n'existent pas dans le type généré de la table `pois`.

**Correction** : Supprimer ces 7 lignes (311-317) de l'objet insert, car la table `pois` n'a pas ces colonnes. Les données enrichies viennent de `medina_pois`, pas de `pois`.

#### 2. `supabase/functions/generate-quest/QuestEngine.ts` (lignes 591, 640-641)
**Problème** : 
- `name_fr`/`name_en` n'existent pas sur `ScoredPOI` (qui est `POI & { _score }`)
- `crowd_level`/`accessibility_notes` n'existent pas sur `Stop`

**Correction** :
- Ligne 591 : `POI` a `name` mais pas `name_fr`/`name_en`. Remplacer par `poi.name || ''`
- Lignes 640-641 : Ajouter `crowd_level?: string` et `accessibility_notes?: string` à l'interface `Stop`

#### 3. `supabase/functions/generate-quest/index.ts` (lignes 230-231)
**Problème** : Cast `EngineOutput as Record<string, unknown>` échoue car les types ne se chevauchent pas assez.

**Correction** : Passer par `unknown` d'abord : `(result as unknown as Record<string, unknown>)`

#### 4. `supabase/functions/poi-auto-agent/index.ts` (ligne 493, 514)
**Problème** : `curr`/`prev` potentiellement `undefined` dans des calculs de distance.

**Correction** : Ajouter des vérifications `!` ou des guards `if (!curr || !prev) continue`

#### 5. `supabase/functions/promote-marker-to-library/index.ts` (ligne 196)
**Problème** : `err` est de type `unknown` dans le catch.

**Correction** : `(err instanceof Error ? err.message : "Erreur interne")`

#### 6. `supabase/functions/process-email-queue/index.ts` (multiples erreurs)
**Problème** : Types incompatibles avec le schéma Supabase auto-généré (table `email_send_log` non reconnue, RPC `move_to_dlq` non typée, paramètres `any` implicites).

**Correction** : Ajouter des casts `as any` ciblés et des annotations de type explicites pour les paramètres `msg` et `id`.

### Fichiers modifiés
- `src/hooks/usePOIs.ts`
- `supabase/functions/generate-quest/QuestEngine.ts`
- `supabase/functions/generate-quest/index.ts`
- `supabase/functions/poi-auto-agent/index.ts`
- `supabase/functions/promote-marker-to-library/index.ts`
- `supabase/functions/process-email-queue/index.ts`

### Impact
- Aucun changement fonctionnel
- Résolution de toutes les erreurs de type bloquant le build

### Prompt pour QUEST RIDES PRO
Pas de nouveau prompt nécessaire — les 3 corrections PRO sont déjà appliquées. Il reste à :
1. Exécuter `sync-pois-import` côté PRO pour remplir les `audio_url_en` depuis HPP
2. Générer une nouvelle visite EN pour vérifier l'audio

