

# Plan : Génération audio FR + EN pour Le Jardin Secret

## POI cible
- **ID** : `34f9f769-dd8e-4d04-b018-c605de7982ad`
- **Nom** : Le Jardin Secret
- Contenu narratif FR et EN déjà complet et de haute qualité

## 4 appels à `generate-poi-audio`

Chaque appel utilise ElevenLabs (voix JdwJ7jL68CWmQZuo7KgG, speed 0.75) avec réécriture Gemini préalable du texte.

| # | Field | Texte source | Storage path |
|---|-------|-------------|--------------|
| 1 | `audio_url_fr` | `history_context` | `jardin-secret/history_fr.mp3` |
| 2 | `audio_url_en` | `history_context_en` | `jardin-secret/history_en.mp3` |
| 3 | `anecdote_audio_url_fr` | `local_anecdote` | `jardin-secret/anecdote_fr.mp3` |
| 4 | `anecdote_audio_url_en` | `local_anecdote_en` | `jardin-secret/anecdote_en.mp3` |

## Étapes

1. **Réécrire chaque texte** via Gemini (style narration élégante, comme défini dans les settings TTS)
2. **Appeler `generate-poi-audio`** 4 fois avec le texte réécrit, le `poi_id`, le `field` et le `storage_path`
3. **Vérifier** que les 4 URLs sont bien écrites dans `medina_pois`

## Nettoyage doublon

Le POI `30a1262c` ("Riad Musée le jardin secret") est en `status=filtered` — c'est un doublon. On le désactive (`is_active = false`) pour éviter toute confusion.

## Aucun fichier source modifié

Uniquement des appels Edge Function et un UPDATE SQL pour le doublon.

