

## Diagnostic — la réponse de l'agent est techniquement correcte mais trompeuse

**La liste des 7 POIs avec audio FR+EN est exacte** (vérifié en base) :
- Koutoubia, Le Jardin Secret, Le marché de l'ancienne Rahba, Madrasa Ben Youssef, Place des Épices, Souk Cherifia, Souk Semmarine.

**Mais Jemaa el-Fna n'y figure pas** — et vous avez raison de souligner que c'est anormal. Voici pourquoi :

### Ce que révèle la base
La place Jemaa el-Fna existe en **20 entrées dupliquées** sous des graphies différentes (`Djemaa el Fna`, `Jemaa el-Fnaa`, `jem3 elfna`, `Jaama El Fna`, etc.). **Aucune n'a d'audio FR ni EN**. La fiche canonique `Djemaa el Fna` (id `11ad43a7…`) est `validated` + `is_active=true` mais reste vide côté audio.

### Pourquoi l'agent ne l'a pas signalé
Le system prompt actuel lui demande juste de répondre à la question. Quand vous dites "non, il manque Jemaa el-Fna", il ne fait pas de seconde requête pour vérifier — il vous a déjà donné la liste exacte selon le filtre `audio_url_fr IS NOT NULL AND audio_url_en IS NOT NULL`.

### Vrais problèmes à corriger (hors scope chat)
1. **Jemaa el-Fna n'a pas d'audio** alors qu'elle devrait être prioritaire (hub de départ majeur).
2. **20 doublons** de Jemaa el-Fna en base — le `poi-quality-agent` devrait les fusionner.
3. L'agent chat pourrait être amélioré pour : quand l'utilisateur conteste une réponse factuelle, il devrait **rechercher activement** le POI mentionné (`get_poi_detail` ou `query_pois` avec ILIKE) avant de répondre.

### Plan d'amélioration de l'Agent Chat (1 fichier)

**`supabase/functions/agent-chat/index.ts`** — enrichir le system prompt avec une règle :
> "Si l'utilisateur conteste ta réponse en mentionnant un POI nommé, **APPELLE OBLIGATOIREMENT** `query_pois({name: ...})` ou `get_poi_detail` pour vérifier l'état réel de ce POI avant de répondre. Explique alors clairement : existe-t-il ? sous quelle graphie ? quel statut ? quels champs manquent ?"

Cela transforme l'agent d'un "répondeur" en "investigateur" quand on le challenge.

### Action immédiate recommandée
Générer les audios FR + EN pour la fiche canonique **Djemaa el Fna** (`11ad43a7-4776-4c2b-99b0-d7f99e7c5dce`) — elle a probablement déjà du contenu narratif enrichi. À faire dans une demande dédiée, comme on l'a fait pour Le Jardin Secret.

