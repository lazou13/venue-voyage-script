

# Fix invocation `poi-quality-agent` LOT 1B

## Constat

- Clic « Générer batch (50) » → toast `Failed to send a request to the Edge Function`
- Aucune ligne `POST .../poi-quality-agent` dans les logs edge au moment des clics (alors que d'autres fonctions sont bien loggées)
- Workers `booted` à 16:52:59 + 16:53:09 (cold-start déclenché par chaque clic) → la fonction démarre puis meurt avant d'envoyer la réponse HTTP
- Pool LOT 1B éligible bien présent en base : 533 restos + 211 generics
- Donc problème infra-invocation localisé dans le code ajouté pour LOT 1B (`selectLot1bPool`), pas dans le métier

## Cause probable

Dans `selectLot1bPool`, l'option `order("reviews_count", { ascending: false, nullsFirst: false })` n'est **pas une option valide** pour `supabase-js` v2 — la propriété attendue est `nullsFirst` (boolean) seul, et associée à un parsing PostgREST qui retourne 400 si la combinaison `ascending: false, nullsFirst: false` n'est pas correctement sérialisée par cette version chargée via `esm.sh`. La promesse rejetée non-catchée tue le worker → le SDK client voit `Failed to send a request`.

S'ajoute un facteur aggravant : aucun `try/catch` global autour de `runRecatPropose` dans le `serve()` n'existe pour ce mode (le `try/catch` global est là, mais l'erreur survient sur l'`await selectLot1bPool` qui peut renvoyer une promesse rejetée silencieuse côté `data` destructuré).

## Correctif (1 fichier)

**`supabase/functions/poi-quality-agent/index.ts`** — modifications minimes, périmètre strict LOT 1B :

1. **Retirer `nullsFirst`** dans `selectLot1bPool` :
   ```ts
   .order("reviews_count", { ascending: false })
   ```
   `null` partira en fin naturellement (comportement PostgreSQL par défaut sur `DESC` = NULLS FIRST, on le compense côté JS en filtrant après).

2. **Durcir `selectLot1bPool`** : envelopper chaque appel Supabase dans son propre try/catch et logger l'erreur Postgrest (`error.message`, `error.details`) pour qu'un éventuel échec futur soit visible dans les logs edge au lieu de tuer le worker.

3. **Logger l'entrée** de `runRecatPropose` (`console.log("recat_propose start", { lotLabel, target })`) pour confirmer en logs que la requête arrive.

4. **Préserver totalement** : pas de changement de signature, pas de changement de pool sélection (P1→P4), pas de changement de batch size 50, pas de changement DRY-RUN, pas de changement UI, pas de changement RecatPilotPanel.

## Vérification post-déploiement

1. Re-déployer `poi-quality-agent`
2. Clic « Générer batch (50) »
3. Vérifier logs edge : doit apparaître `POST | 200 | …/poi-quality-agent`
4. Vérifier `console.log("recat_propose start", …)` présent
5. UI doit recevoir `{ report_id, status: "pending", pilot_size: 50, lot_label: "lot1b_batch01" }` et démarrer le polling

## Périmètre strict respecté

- 1 seul fichier touché
- Aucun changement métier
- Aucun changement UI
- Aucun changement schéma
- Aucun changement priorisation P1→P4
- Aucun changement batch size 50
- Aucun changement DRY-RUN
- Aucun changement persistance `recat_decision`/`recat_note`

