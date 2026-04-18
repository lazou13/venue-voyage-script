

L'utilisateur veut générer les audios FR et EN pour Jemaa el-Fna (fiche canonique `Djemaa el Fna`, id `11ad43a7-4776-4c2b-99b0-d7f99e7c5dce`).

## Plan : Générer audios FR + EN pour Djemaa el Fna

### Contexte
- POI canonique : `Djemaa el Fna` (`11ad43a7-4776-4c2b-99b0-d7f99e7c5dce`), `validated`, `is_active=true`.
- Aucun audio FR/EN actuellement.
- Edge function `generate-poi-audio` déjà en place (ElevenLabs voice `JdwJ7jL68CWmQZuo7KgG`, speed 0.75).
- Mémoire `tts-generation-settings` : réécriture Gemini avant TTS pour narration élégante.

### Étapes

1. **Vérifier le contenu narratif source** du POI : récupérer `history_context` (FR), `history_context_en`, `local_anecdote_fr`, `anecdote_en` ou équivalents. S'ils sont vides → enrichir d'abord (mais visiblement Jemaa el-Fna est validated donc devrait avoir du contenu).

2. **Réécriture Gemini "narration élégante"** (selon mémoire TTS) :
   - Texte FR : combiner `history_context` + `local_anecdote_fr` → prompt Gemini pour narration guide expert ~150-200 mots, ton oral, transitions naturelles.
   - Texte EN : même chose à partir de `history_context_en` + anecdote EN.

3. **Appel `generate-poi-audio`** deux fois :
   - `{ poi_id: "11ad43a7…", field: "audio_url_fr", text: <texte FR réécrit>, storage_path: "11ad43a7…/fr.mp3" }`
   - `{ poi_id: "11ad43a7…", field: "audio_url_en", text: <texte EN réécrit>, storage_path: "11ad43a7…/en.mp3" }`

4. **Vérification** : lecture des `audio_url_fr` / `audio_url_en` en base après génération + test que le fichier MP3 est lisible.

### Implémentation
Action one-shot via Supabase tools en mode default :
- `read_query` pour récupérer le contenu narratif source.
- Appel Lovable AI Gateway (Gemini 2.5 Flash) pour réécriture FR + EN.
- `curl_edge_functions` deux fois sur `/generate-poi-audio`.
- `read_query` final pour confirmer les URLs.

Si `history_context` ou anecdote vide → l'indiquer et proposer d'enrichir d'abord via `anecdote-enricher`.

### Fichiers
Aucune modification de code. Pure exécution de scripts/edge functions existants.

