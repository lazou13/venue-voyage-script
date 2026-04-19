

User veut générer **uniquement l'audio "anecdote" de la Koutoubia en EN** (`anecdote_audio_url_en`), avec les réglages voix habituels (déjà en mémoire : ElevenLabs JdwJ7jL68CWmQZuo7KgG, eleven_multilingual_v2, stability 0.3, similarity 0.9, style 0.85, speed 0.75). Politique TTS : feed `local_anecdote_en` brut, pas de réécriture.

Avant régénération → afficher le texte source pour validation.

## Plan

### Étape 1 — Identifier le POI canonique Koutoubia
Requête SQL :
```sql
SELECT id, name, status, local_anecdote_en, local_anecdote, anecdote_audio_url_en
FROM medina_pois
WHERE (name ILIKE '%koutoubia%' OR name_fr ILIKE '%koutoubia%')
  AND status = 'validated'
ORDER BY poi_quality_score DESC NULLS LAST;
```
S'il y a plusieurs POIs Koutoubia, prendre celui avec le score le plus haut (probablement le canonique mosquée/minaret) ou demander confirmation.

### Étape 2 — Afficher le texte EN à valider
Présenter `local_anecdote_en` tel quel + nettoyer marqueurs `[1][2]` éventuels (comme fait pour Médersa Ben Youssef). Tu valides → A (OK), B (corrige X), C (réécris).

### Étape 3 — Régénération (après ton OK)
Appel `generate-poi-audio` avec :
- `poi_id` = id Koutoubia
- `field` = `anecdote_audio_url_en`
- `text` = `local_anecdote_en` (nettoyé)
- `storage_path` = `audio-guides/{koutoubia_id}/anecdote_en_v{timestamp}.mp3` (versionné, policy CDN)

Config voix = inchangée, déjà codée en dur dans `generate-poi-audio`.

### Étape 4 — Vérification
Lecture du POI : `anecdote_audio_url_en` pointe vers bucket interne `audio-guides`, taille KB > 0.

## Fichiers touchés
Aucun changement de code. Pure orchestration : 1 SELECT + 1 UPDATE optionnel (clean markers) + 1 invoke edge function.

