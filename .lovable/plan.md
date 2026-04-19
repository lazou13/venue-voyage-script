

User veut :
1. Garder canonique = `b11998e9` "Médersa Ben Youssef" (et pas Madrasa) → fusionner `4a3a523a` dedans.
2. Régénérer audios FR + EN.
3. **Voir les textes avant** régénération.
4. Config voix inchangée (ElevenLabs JdwJ7jL68CWmQZuo7KgG, speed 0.75, stability 0.3, similarity 0.9, style 0.85, model eleven_multilingual_v2) — déjà en mémoire.

Vérifié en base : `b11998e9` a `history_context` (FR) et `history_context_en` + `local_anecdote` / `local_anecdote_en`. C'est ce texte qui sera utilisé tel quel (politique TTS : pas de réécriture LLM).

## Plan

### Étape 1 — Affichage des textes (avant tout)
Je récupère et te présente, sans rien modifier :
- `history_context` (FR) — base audio principale FR
- `local_anecdote` (FR) — base audio anecdote FR
- `history_context_en` — base audio principale EN
- `local_anecdote_en` — base audio anecdote EN

Tu valides chaque texte (ou demandes une correction manuelle directe en base) avant régénération.

### Étape 2 — Fusion du doublon
Une fois textes validés :
- `merge_pois({canonical_id: "b11998e9-0650-4bec-a7ee-77ef25564bfa", duplicate_ids: ["4a3a523a-f29c-4459-884f-1a585942d23b"], confirm: true})`
- Cela rapatrie `poi_media`, recommandations, photos client vers le canonique.

### Étape 3 — Régénération des 4 audios sur le canonique `b11998e9`
Via la fonction `generate-poi-audio` existante, avec chemins **versionnés** (politique cache CDN) :
- `audio-guides/b11998e9-0650-4bec-a7ee-77ef25564bfa/fr_v{ts}.mp3` → champ `audio_url_fr` ← `history_context`
- `audio-guides/b11998e9-0650-4bec-a7ee-77ef25564bfa/en_v{ts}.mp3` → champ `audio_url_en` ← `history_context_en`
- `audio-guides/b11998e9-0650-4bec-a7ee-77ef25564bfa/anecdote_fr_v{ts}.mp3` → `anecdote_audio_url_fr` ← `local_anecdote`
- `audio-guides/b11998e9-0650-4bec-a7ee-77ef25564bfa/anecdote_en_v{ts}.mp3` → `anecdote_audio_url_en` ← `local_anecdote_en`

Config voix : strictement identique à ce qui est déjà codé dans `generate-poi-audio` (rien à changer).

### Étape 4 — Vérification
- Lecture de `b11998e9` après update : 4 URLs sur bucket interne `audio-guides`, taille KB > 0.
- Confirmation que `4a3a523a` a été supprimé/désactivé par le merge.

## Fichiers touchés
Aucun changement de code. Uniquement :
- Lectures SQL (`medina_pois`)
- Appels d'edge functions existantes (`agent-chat` → `merge_pois`, puis `generate-poi-audio` x4)

## Question avant exécution
Aucune — j'ai juste besoin de basculer en mode édition pour :
1. te lire les 4 textes,
2. attendre ton "OK régénère" (ou tes corrections),
3. lancer la fusion + 4 régénérations.

