

User confirme : les sections Must See/Must Try/Visit Nearby s'affichent en FR alors que le tour est EN. PRO a déjà fait le diagnostic et propose un plan. Je dois le valider/affiner côté HPP (source de vérité).

## Diagnostic vérifié

Côté HPP (`medina_pois`), je dois confirmer pour les 5 POIs du KJTOUR :
- Koutoubia (`eec26470-...`)
- Madrasa Ben Youssef
- Souk Semmarine
- Jardin Secret
- Jemaa el-Fna

Champs à vérifier : `must_see_details_en`, `must_try_en`, `must_visit_nearby_en`, `photo_tip_en`, `price_info_en`, `opening_hours` (JSON avec text_en ?).

Politique mémoire : EN obligatoire pour tous les POIs validés (`english-enrichment-strategy`). HPP = source de vérité, Production = consommateur via sync.

## Plan

### Étape 1 — Audit HPP (lecture SQL)
Vérifier exactement quels champs `_en` manquent sur les 5 POIs du KJTOUR. Affichage tableau : POI × champ → ✅/❌.

### Étape 2 — Compléter les traductions manquantes côté HPP
Pour chaque champ `_en` manquant, deux options :
- **A)** Génération auto via edge function `translate` (Lovable AI Gateway, cf. `supabase/functions/translate/index.ts`) en feed des `_fr` existants
- **B)** Lancer `poi-auto-agent` (cron qui traduit 20×10 par batch — `autonomous-enrichment-agent`)

Recommandation : **A** ciblé sur les 5 POIs × 5 champs (≤25 appels), instantané. Validation visuelle rapide.

Migration SQL UPDATE pour persister les traductions générées.

### Étape 3 — Sync vers Production
Deux voies :
- **API v2 sync route** (`api-v2?route=sync`) — méthode officielle, déjà mappée (`poi-sync-schema-mapping`)
- **Edge function ad hoc** comme proposé par PRO (`admin-patch-kjtour-en-sections`) — patche directement le JSONB `medina_tours.route`

Recommandation : **API v2 sync** d'abord (propre, réutilisable). Si PRO stocke effectivement les sections gelées dans `medina_tours.route` JSONB et ne re-lit pas la table `medina_pois` au runtime, alors ajouter le patch JSONB ciblé pour KJTOUR_EN.

→ **Question à clarifier** : PRO lit-il `medina_pois` au runtime (sync suffit) ou le JSONB `medina_tours.route` (patch obligatoire) ? Le diagnostic PRO dit clairement "vit sur Production dans medina_tours.route (JSONB)" → il faut **les deux** : sync HPP→PROD + patch JSONB.

### Étape 4 — Vérification end-to-end
Rejouer KJTOUR_EN sur l'app PRO → 5/5 stops avec sections EN remplies.

## Fichiers touchés

- 1 migration SQL (UPDATE `medina_pois` côté HPP avec traductions EN)
- Aucun changement UI HPP
- Côté PRO (cross-project) : 1 edge function temporaire `admin-patch-kjtour-en-sections` ou appel à leur sync existant

## Question avant exécution

Avant de lancer, je propose :
1. **Étape 1 d'abord** : audit SQL pour voir exactement les trous → te montrer le tableau
2. Tu valides la liste des champs à traduire
3. Je génère via `translate` + te montre les traductions EN avant de les persister (politique habituelle "voir le texte avant")
4. Push DB + sync PRO

OK pour cet ordre ?

