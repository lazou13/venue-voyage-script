

L'utilisateur soulève deux points critiques :

1. **Réglages TTS** : oui, j'ai bien utilisé les mêmes réglages (voice `JdwJ7jL68CWmQZuo7KgG`, speed 0.75, stability 0.3, similarity 0.9, style 0.85, model `eleven_multilingual_v2`) — c'est codé en dur dans `generate-poi-audio/index.ts`. Donc cohérent avec la mémoire `tts-generation-settings`.

2. **Source du texte** : c'est le vrai problème. J'ai réécrit le texte avec Gemini avant TTS, ce qui crée des versions divergentes du contenu officiel. L'utilisateur veut que les audios soient générés **directement à partir des champs déjà enrichis et validés** en base (`history_context` + `local_anecdote` pour FR, `history_context_en` + `local_anecdote_en` pour EN), sans réécriture, pour rester cohérent avec ce qui s'affiche partout ailleurs (road book, road guide, app player).

Or la mémoire `tts-generation-settings` mentionne "Gemini rewrite before TTS". Il faut que je clarifie : soit on garde la réécriture (mais alors elle doit être déterministe/cachée), soit on supprime la réécriture et on lit le texte brut.

L'utilisateur dit clairement : "c'est ceux là qu'il faut reprendre pas les refaire à chaque audio ça va tout embrouiller". Donc → **lecture directe du contenu existant**, pas de réécriture Gemini.

## Plan : corriger les audios Djemaa el Fna + uniformiser la politique TTS

### 1. Régénérer les 2 audios Djemaa el Fna à partir des textes officiels
- Lire en base : `history_context` + `local_anecdote` (FR), `history_context_en` + `local_anecdote_en` (EN).
- Concaténer simplement : `${history_context}\n\n${local_anecdote}` (idem EN), avec une légère normalisation (espaces, ponctuation finale).
- Aucun appel Gemini. Envoi direct à `generate-poi-audio` avec les mêmes réglages ElevenLabs déjà en place (0.75 / 0.3 / 0.9 / 0.85, voice JdwJ7jL68CWmQZuo7KgG, model eleven_multilingual_v2).
- Écraser `audio_url_fr` et `audio_url_en` (storage upsert true → même chemin `11ad43a7…/fr.mp3` et `/en.mp3`).

### 2. Mettre à jour la mémoire `tts-generation-settings`
Remplacer la règle "Gemini rewrite before TTS" par :
> **Source du texte** : utiliser directement `history_context` + `local_anecdote` (FR) et `history_context_en` + `local_anecdote_en` (EN) tels qu'ils existent en base. **Ne jamais réécrire** avec un LLM avant TTS — cela crée des divergences entre l'audio et le contenu textuel affiché ailleurs (road book, app player, fiches POI).

### 3. Vérification
- Re-query `medina_pois` pour confirmer que `audio_url_fr` et `audio_url_en` pointent toujours vers les bons chemins.
- Fournir les liens à l'utilisateur pour validation auditive.

### Fichiers
Aucune modification de code applicatif. Pure exécution :
- 2 appels `generate-poi-audio` (en parallèle).
- 1 update de `mem://technical/tts-generation-settings` + `mem://index.md`.

### Note
La voix, la vitesse 0.75 et tous les autres paramètres restent **strictement identiques** aux audios précédents (Koutoubia, Jardin Secret, etc.) — garantie de cohérence sonore dans toute la bibliothèque.

