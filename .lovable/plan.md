

## Constat

L'agent chat actuel est **lecture seule** : il a 6 outils (`query_pois`, `count_pois`, `get_poi_detail`, `pipeline_stats`, `list_categories`, `list_zones`). Il ne peut donc pas modifier la base, générer des audios, lancer le pipeline, etc. C'est exactement la limite que tu rencontres.

Tu veux qu'il devienne un véritable **agent autonome** capable de tout faire ce que tu fais à la main dans l'admin.

## Plan : transformer l'agent en agent "full-power"

### 1. Ajouter des outils d'écriture sur `medina_pois`

- `update_poi` : modifier n'importe quel champ texte/booléen/numérique d'un POI (whitelist large : history_context, local_anecdote_fr/en, fun_fact, riddle_*, name, name_fr/en, status, is_active, is_start_hub, hub_theme, category, zone, etc.).
- `delete_poi` : supprimer un POI (avec id obligatoire).
- `merge_pois` : fusionner des doublons (garder un id "canonique", déplacer les médias, supprimer les autres).
- `set_poi_status` : raccourci pour passer draft → validated / archived.

### 2. Ajouter des outils d'action sur le pipeline et les médias

- `generate_audio` : appelle `generate-poi-audio` pour un POI + langue (fr/en) + type (history/anecdote), avec chemin versionné (timestamp) — conforme à la mémoire `tts-generation-settings`.
- `enrich_poi` : appelle `anecdote-enricher` / `wiki-name-enricher` / `poi-enricher` sur un POI précis.
- `translate_poi_fields` : appelle `translate` pour produire les champs `_en` manquants.
- `fetch_photos` : appelle `poi-fetch-photos` pour récupérer la photo Google d'un POI.
- `run_quality_agent` : lance `poi-quality-agent` (dry-run ou live).
- `run_watchdog` : lance `poi-watchdog`.

### 3. Ajouter des outils SQL avancés (read + write contrôlés)

- `find_duplicates` : détecte les POIs avec nom proche ou GPS < 15m (utile pour Jemaa el-Fna).
- `bulk_update` : update sur N POIs sélectionnés par filtre (ex : "passe tous les POIs validated avec audio_fr en `is_active=true`"). Limite stricte : max 50 lignes par appel + confirmation requise.

### 4. Garde-fous obligatoires

- **Auth admin** : l'edge function vérifie que l'appelant est bien admin via JWT (`has_role(auth.uid(), 'admin')`) avant d'autoriser tout outil d'écriture. Les outils lecture restent comme aujourd'hui.
- **Confirmation pour les actions destructrices** : `delete_poi`, `merge_pois`, `bulk_update` exigent un argument `confirm: true`. L'agent doit d'abord montrer ce qu'il va faire, puis attendre que tu valides en chat avant de rappeler l'outil avec `confirm: true`.
- **Logging** : chaque action d'écriture est loggée (console.log + idéalement table `agent_action_log` — à voir si tu veux la créer).
- **Pas de SQL libre** : on ne donne pas un outil "exécute n'importe quel SQL" — trop dangereux. Tout passe par des outils typés.

### 5. Mise à jour du system prompt

L'agent reçoit la liste de tous ses nouveaux pouvoirs et la règle :
> "Tu peux modifier la base et lancer des actions. Avant toute action destructive (delete, merge, bulk_update, regénération coûteuse), tu DOIS d'abord présenter ce que tu vas faire et attendre une confirmation explicite de l'utilisateur en français ('ok', 'oui', 'vas-y', 'confirme'). Pour les actions simples (update d'un champ texte, génération d'un audio sur un POI précis), tu peux exécuter directement."

### 6. Boucle d'agent étendue

Passer `MAX_ITER` de 5 à 10 pour permettre des séquences plus longues (ex : trouver doublons → fusionner → régénérer audio → valider).

## Fichier impacté

- `supabase/functions/agent-chat/index.ts` (refonte des outils + auth admin + system prompt).

Aucun autre fichier touché. L'UI `AdminAgentChat.tsx` reste inchangée — elle envoie déjà le JWT admin via `Authorization: Bearer ...`, il faut juste remplacer la clé publique par le token de session pour que l'edge function vérifie le rôle.

### Petit ajustement client

Dans `AdminAgentChat.tsx`, remplacer :
```
Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
```
par le JWT de la session admin (`supabase.auth.getSession()`), pour que l'edge function puisse valider que l'appelant est admin avant d'autoriser les outils d'écriture.

## Résultat

Après ces changements, tu pourras dire en chat :
- "supprime tous les doublons de Jemaa el-Fna sauf la fiche canonique"
- "régénère les 4 audios de la Koutoubia avec chemins versionnés"
- "passe tous les POIs validated qui ont les 4 audios en is_start_hub si ils sont à moins de 100m de Jemaa el-Fna"
- "corrige le nom 'jem3 elfna' en 'Djemaa el Fna'"
- "lance le quality agent en mode live"

…et il le fera, en te demandant confirmation pour les actions risquées.

