

## Plan : Générer les audios FR et EN de Jemaa el-Fnaa via ElevenLabs TTS

### Contexte
- POI : Jemaa el-Fnaa (`71e3f93d-601e-49cd-8388-edd86efd5b08`)
- Textes FR et EN riches (~250 mots chacun, `history_context` + `local_anecdote`)
- Voix demandée : `JdwJ7jL68CWmQZuo7KgG`
- ElevenLabs connecté, `ELEVENLABS_API_KEY` disponible

### Étapes

1. **Créer un script `/tmp/generate-jemaa-audio.ts`** exécuté via `code--exec`
   - Récupère les textes FR (`history_context` + `local_anecdote`) et EN (`history_context_en` + `local_anecdote_en`)
   - Appelle l'API ElevenLabs TTS (`eleven_multilingual_v2`, voix `JdwJ7jL68CWmQZuo7KgG`) deux fois (FR, EN)
   - Sauvegarde les MP3 dans `/mnt/documents/jemaa-el-fnaa_fr.mp3` et `/mnt/documents/jemaa-el-fnaa_en.mp3`

2. **Livrer les 2 fichiers MP3** en téléchargement

### Détails techniques
- Modèle : `eleven_multilingual_v2` (FR + EN natifs)
- Format : MP3 44.1kHz 128kbps
- Voix unique pour les deux langues (multilingue)
- Pas de edge function — script one-shot direct via `fetch` + API key

### Livrable
- `jemaa-el-fnaa_fr.mp3`
- `jemaa-el-fnaa_en.mp3`

