

## Plan : Générer les audios Jemaa el-Fnaa (tentative 2)

### Contexte
La clé ElevenLabs a été mise à jour (terminant par `b80b`). La connexion est active.

### Étapes

1. **Vérifier les secrets disponibles** via `fetch_secrets` pour confirmer que `ELEVENLABS_API_KEY` est bien injecté
2. **Récupérer les secrets de la connexion** via `get_connection_secrets` pour obtenir le nom exact de la variable
3. **Exécuter le script TTS** via `code--exec` :
   - Texte FR : `history_context` + `local_anecdote` de Jemaa el-Fnaa
   - Texte EN : `history_context_en` + `local_anecdote_en`
   - Voix : `JdwJ7jL68CWmQZuo7KgG`
   - Modèle : `eleven_multilingual_v2`
   - Sortie : `/mnt/documents/jemaa-el-fnaa_fr.mp3` et `/mnt/documents/jemaa-el-fnaa_en.mp3`

### Détails techniques
- Appel direct à `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}?output_format=mp3_44100_128`
- Header `xi-api-key` avec la clé depuis `Deno.env` / env vars sandbox
- Script Python one-shot avec `requests`

### Livrable
- 2 MP3 téléchargeables

