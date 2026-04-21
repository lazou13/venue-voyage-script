

# Diagnostic — « Failed to send a request to the Edge Function »

## Symptôme
Toast rouge **« Erreur génération · Failed to send a request to the Edge Function »** à chaque clic sur **Générer batch (50)**.

## Causes possibles (à vérifier dans l'ordre)

1. **Pool LOT 1B épuisé** — Le rapport visible « 1 POIs · lot1b_debug_readonly » suggère que la quasi-totalité des restaurants/generics éligibles ont déjà `metadata.recat_batch` commençant par `lot1b_` et sont exclus par l'idempotence (lignes 364-368 de `poi-quality-agent/index.ts`). Si le pool tombe à 0, la fonction insère quand même un rapport vide mais le toast peut quand même apparaître.

2. **Timeout réseau invocation** — `supabase.functions.invoke()` renvoie cette erreur générique quand l'edge function ne répond pas dans le délai client (~150s). La fonction insère le rapport puis lance `EdgeRuntime.waitUntil` ; l'insert doit donc revenir vite. Si l'insert traîne (DB lente vue précédemment) → timeout.

3. **Crash/boot lent intermittent** — Les logs montrent uniquement des cycles boot/shutdown récents, aucune trace de l'invocation utilisateur. Soit l'invocation n'est jamais arrivée (DNS/réseau côté preview), soit elle a coupé avant d'atteindre `console.log`.

## Plan de correction (Build mode)

### Étape 1 — Instrumentation immédiate
Ajouter des logs au tout début de `runRecatPropose` (avant la sélection du pool) pour distinguer les 3 causes :
- log d'entrée avec `lotLabel`, `target`, timestamp
- log juste après `selectLot1bPool` avec `pool.length`
- log juste après l'insert initial avec `reportId`

### Étape 2 — Garde-fou pool vide
Si `pool.length === 0` :
- ne **pas** insérer de rapport
- renvoyer immédiatement `{ error: "pool_empty", message: "Tous les POIs éligibles LOT 1B ont déjà été traités. Vérifier metadata.recat_batch." }`
- côté UI : afficher ce message dans le toast au lieu de l'erreur générique

### Étape 3 — Diagnostic état actuel du pool
Exécuter une requête SQL de comptage pour mesurer combien de POIs sont encore éligibles :
```
SELECT
  category,
  COUNT(*) FILTER (WHERE metadata->>'recat_batch' LIKE 'lot1b_%') AS deja_traites,
  COUNT(*) FILTER (WHERE metadata->>'recat_batch' IS NULL OR metadata->>'recat_batch' NOT LIKE 'lot1b_%') AS restant_eligible
FROM medina_pois
WHERE is_active = true
  AND status IN ('validated','enriched')
  AND lat BETWEEN 31.60 AND 31.67
  AND lng BETWEEN -8.02 AND -7.97
  AND name_fr IS NOT NULL
  AND is_start_hub = false
  AND is_main_visit = false
  AND category IN ('restaurant','generic')
GROUP BY category;
```
Résultat attendu :
- si `restant_eligible` ≈ 0 → confirmé : pool épuisé, batch impossible jusqu'à reset
- si `restant_eligible` > 0 → la cause est ailleurs (timeout/crash), passer aux logs

### Étape 4 — Côté client : message d'erreur exploitable
Dans `RecatPilotPanel.tsx` (handler `generatePilot`), distinguer :
- `error.message` contient `Failed to send` → afficher « Backend injoignable, réessayer dans 30s »
- `data.error === "pool_empty"` → afficher « Pool LOT 1B épuisé · X POIs déjà traités »
- autres erreurs → message brut

### Étape 5 — Reset éventuel (si pool épuisé confirmé)
Si étape 3 confirme pool vide, proposer un bouton admin **Reset metadata.recat_batch** ciblé sur les POIs marqués `lot1b_debug_readonly` (test, à exclure des vrais batches). Migration SQL au cas par cas, jamais automatique.

## Périmètre
- 1 fichier edge : `supabase/functions/poi-quality-agent/index.ts` (logs + garde-fou pool vide)
- 1 fichier UI : `src/components/admin/RecatPilotPanel.tsx` (messages d'erreur)
- 0 changement de schéma
- 0 impact sur LOT 1A déjà validé
- Aucun reset de données sans confirmation explicite

## Prochaine étape
Approuver pour passer en Build mode :
- **A** : juste étape 1 (instrumentation) + étape 3 (diagnostic SQL) en lecture, puis on tranche
- **B** : tout d'un coup (instrumentation + garde-fou + messages UI)
- **C** : juste étape 3 (SQL count) d'abord, sans toucher au code

