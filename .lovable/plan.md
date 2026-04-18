

## Plan : Donner à l'Agent Chat un accès réel aux données

### Problème
L'agent répond actuellement avec son seul prompt système — il n'a **aucun accès à la base**. Quand on lui demande "la liste des POIs avec audio", il invente ou refuse car il ne peut rien interroger.

### Solution : Tool Calling + Service Role
On transforme l'edge function `agent-chat` en agent avec **outils SQL** que Gemini peut appeler en boucle jusqu'à obtenir la réponse.

### Architecture (boucle agentique)

```text
User → agent-chat
   ↓
Gemini (avec tools)
   ↓
[tool_call] → exécution SQL côté serveur (service role)
   ↓
résultat injecté → Gemini
   ↓
... (jusqu'à 5 itérations max)
   ↓
Réponse finale streamée au client
```

### Outils exposés à Gemini

1. **`query_pois`** — recherche/filtre POIs : `name` (ILIKE), `category`, `zone`, `status`, `is_active`, `has_audio_fr`, `has_audio_en`, `missing_field` (anecdote_fr, history_context_en, riddle_easy, etc.), `limit` (max 50). Retourne `id, name, category, zone, status` + champs demandés.
2. **`count_pois`** — compte avec mêmes filtres. Pour "combien de POIs ont un audio FR ?".
3. **`get_poi_detail`** — fiche complète d'un POI par `id` ou `name` (tous champs enrichis FR/EN, audio paths, score).
4. **`pipeline_stats`** — vue d'ensemble : total, par status, % enrichi par champ (anecdote, history, riddles, audio FR/EN, photos), POIs hors-bbox.
5. **`list_categories`** / **`list_zones`** — taxonomie disponible.

Toutes les requêtes utilisent **`SUPABASE_SERVICE_ROLE_KEY`** côté edge (lecture seule, jamais d'INSERT/UPDATE/DELETE).

### Boucle de streaming
- Premier appel Gemini : `stream: false` tant qu'il y a des tool_calls.
- Quand Gemini renvoie `finish_reason: "tool_calls"` → exécuter, repush, reboucler.
- Quand Gemini renvoie du contenu final → bascule en `stream: true` pour token-by-token vers le client (compatible avec le parser SSE existant côté frontend).
- Limite de sécurité : 5 itérations max, sinon réponse "trop d'étapes".

### Prompt système enrichi
Liste les outils disponibles + règles : "Utilise TOUJOURS les outils pour répondre sur les données réelles. Ne JAMAIS inventer un nom de POI ou un chiffre. Si la requête est ambigüe, demande à l'utilisateur."

### Fichiers modifiés
- **`supabase/functions/agent-chat/index.ts`** — refonte avec tools + boucle agentique + service role.
- **Aucun changement frontend** : `AdminAgentChat.tsx` reçoit déjà du SSE standard, le contrat reste identique.

### Sécurité
- Service role utilisé uniquement côté serveur, jamais exposé.
- Whitelist stricte des champs/tables interrogeables (uniquement `medina_pois` en lecture).
- Pas de SQL libre — paramètres typés via le query builder Supabase.
- L'edge function reste protégée derrière le rôle admin (la page n'est accessible que via `ProtectedRoute requireAdmin`).

### Résultat attendu
- "Donne moi la liste des POIs avec audio" → l'agent appelle `query_pois({has_audio_fr: true})` → renvoie la vraie liste.
- "Combien de POIs sans anecdote EN ?" → `count_pois({missing_field: 'anecdote_en'})` → vrai chiffre.
- "Détaille Le Jardin Secret" → `get_poi_detail({name: 'Jardin Secret'})` → fiche complète.

