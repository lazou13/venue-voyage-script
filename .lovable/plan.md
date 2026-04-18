
Le plus probable est que vous entendez encore l’ancien audio à cause du cache, pas parce que les réglages sont faux.

## Constat
- `generate-poi-audio` écrase bien le fichier existant avec `upsert: true`.
- Mais il réutilise le même `storage_path` et donc la même URL publique.
- Si on régénère `.../fr.mp3` sur la même URL, le navigateur ou le CDN peut continuer à servir l’ancienne version pendant un moment.

## Plan
1. Vérifier l’état réel du POI `Djemaa el Fna` en backend :
   - contenu source FR/EN actuellement en base,
   - `audio_url_fr` / `audio_url_en`,
   - timestamps éventuels pour confirmer la dernière génération.

2. Régénérer les audios FR et EN à partir des champs officiels déjà validés :
   - FR = `history_context` + `local_anecdote`
   - EN = `history_context_en` + `local_anecdote_en`
   - sans aucune réécriture LLM
   - avec les mêmes réglages ElevenLabs (`speed 0.75`, `stability 0.3`, `similarity 0.9`, `style 0.85`).

3. Éviter le cache en changeant le chemin fichier :
   - au lieu de réécrire `fr.mp3` / `en.mp3`,
   - générer par exemple `fr_v2.mp3` et `en_v2.mp3` ou un nom versionné/timestampé,
   - puis mettre à jour `audio_url_fr` et `audio_url_en` avec ces nouvelles URLs.

4. Vérifier après génération :
   - confirmer que les URLs en base ont bien changé,
   - vous redonner le nouveau lien FR,
   - vous faire tester en navigation privée pour confirmer que ce n’est plus l’ancien audio.

## Ajustement recommandé pour éviter que ça se reproduise
- Modifier la logique de génération pour ne plus réutiliser systématiquement le même nom de fichier quand on “corrige” un audio existant.
- Garder des noms versionnés pour toute régénération manuelle.

## Détail technique
Le code actuel de `supabase/functions/generate-poi-audio/index.ts` :
- upload dans le bucket `audio-guides`
- avec `upsert: true`
- puis retourne une URL publique construite à partir du même `storage_path`

Donc si on régénère au même chemin, l’URL reste identique, ce qui explique exactement votre symptôme : “c’est le même audio qu’avant”.

## Résultat attendu
Après exécution :
- nouveau MP3 FR réellement distinct,
- nouvelle URL FR,
- aucun doute possible entre ancienne et nouvelle version.
