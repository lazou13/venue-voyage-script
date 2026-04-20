

Objectif : rendre le pipeline HPP pilotable, stoppable et réellement utile pour nettoyer la base (doublons, traductions, qualité), au lieu de laisser tourner des boucles opaques qui n’assainissent pas `medina_pois`.

Constats vérifiés dans le code :
- `Autopipeline` n’a aucun vrai mécanisme d’arrêt : il enchaîne les étapes sans vérifier de signal d’annulation.
- `EnrichmentPipelineCard` a un `abortRef`, mais aucun bouton Stop et l’arrêt n’est pas propagé proprement aux statuts.
- Le bouton `clean/merge` de `/admin/poi-pipeline` appelle `admin-run-cleanup`, mais cette edge function exécute `cleanup_expired_data()` (instances/orders), pas le nettoyage POI.
- `poi-auto-agent` gère surtout : filtre géo, auto-validation, enrichissement audience, traduction EN, génération bibliothèque. Il ne traite pas les doublons ni le nettoyage qualité.
- Les sélections batchs ne sont pas toujours ordonnées de façon stable (`poi_quality_score` sans `id ASC` partout), ce qui peut donner une impression de blocage.
- La page a aussi un warning React sur `Badge` (pas prioritaire, mais facile à corriger pendant l’intervention).

Plan proposé

1. Rendre l’autopipeline stoppable côté UI
- Ajouter un bouton `Stop` sur la bannière de run actif et sur le bouton `Autopipeline`.
- Utiliser `pipeline_runs.status` existant pour gérer : `running` → `cancel_requested` → `cancelled` ou `completed` (pas besoin de nouveau schéma).
- Afficher un message clair : “arrêt demandé, fin du batch en cours puis interruption”.

2. Refactorer les boucles pour écouter l’arrêt
- Ajouter une fonction partagée du style `shouldStop(runId)` dans `AdminPOIPipeline`.
- Vérifier ce flag :
  - avant chaque étape,
  - entre chaque batch,
  - après chaque attente (`setTimeout`),
  - avant de marquer une étape comme réussie.
- Si arrêt demandé :
  - stopper proprement,
  - mettre à jour `pipeline_runs` avec `status = 'cancelled'`,
  - conserver les logs et les étapes déjà terminées,
  - ne pas afficher “succès” trompeur.

3. Corriger le faux nettoyage `clean/merge`
- Réécrire `admin-run-cleanup` pour qu’il route réellement selon `action` :
  - `clean` → `clean_low_quality_pois()`
  - `merge` → `merge_duplicate_pois()`
- Conserver la vérification admin existante.
- Retourner des logs/counters exploitables dans l’UI.

4. Renforcer la logique de fusion des doublons
- Faire évoluer `merge_duplicate_pois()` pour une vraie fusion HPP :
  - choisir un canonical POI,
  - réassigner les références liées avant fusion (`poi_media`, et toutes les tables qui pointent vers un POI de bibliothèque),
  - marquer les doublons `merged` et `is_active = false` au minimum.
- Améliorer la détection :
  - nom normalisé,
  - distance,
  - priorité au meilleur POI (score/avis/contenu),
  - éviter les faux positifs.
- Résultat attendu : la base visible côté HPP ne garde qu’un canonique exploitable.

5. Étendre l’agent autonome en “agent de propreté HPP”
- Ajouter un cycle explicite :
  1. filtre géographique,
  2. nettoyage qualité,
  3. fusion doublons,
  4. enrichissement,
  5. complétude EN,
  6. backfill infos pratiques si manquantes,
  7. validation/visites.
- L’agent doit travailler “jusqu’à extinction du backlog” avec limites de sécurité par batch, et retourner un résumé par phase.
- L’écran `AgentMonitoringCard` affichera les compteurs utiles : doublons fusionnés, POIs filtrés, traductions ajoutées, POIs encore incomplets.

6. Fiabiliser les traductions pour HPP
- Étendre/fiabiliser la complétude EN sur tous les champs enrichis réellement utilisés par le player.
- Ajouter une gestion explicite de `opening_hours` quand le JSON doit contenir une version EN (`text_en`) au lieu de laisser uniquement du FR.
- Uniformiser les filtres “FR présent / EN manquant” entre agent et action manuelle `translate-en`.

7. Éviter les faux blocages
- Ajouter un tri stable sur tous les batchs sensibles : `order("poi_quality_score", { ascending: false }).order("id", { ascending: true })`.
- Harmoniser les réponses edge functions pour toujours renvoyer des compteurs cohérents (`processed`, `remaining`, `updated`, `logs`).
- Empêcher l’UI de marquer une étape “terminée” quand elle a été annulée.

8. Correctif annexe sur la page admin
- Corriger `Badge` avec `React.forwardRef` pour supprimer le warning console sur `/admin/poi-pipeline`.
- Ce n’est pas la cause métier, mais ça nettoie le debug de la page.

Détails techniques
- Fichiers front :
  - `src/pages/admin/AdminPOIPipeline.tsx`
  - `src/components/admin/EnrichmentPipelineCard.tsx`
  - `src/components/admin/AgentMonitoringCard.tsx`
  - `src/components/ui/badge.tsx`
- Fichiers backend :
  - `supabase/functions/admin-run-cleanup/index.ts`
  - `supabase/functions/poi-auto-agent/index.ts`
- SQL à revoir :
  - fonction `clean_low_quality_pois()`
  - fonction `merge_duplicate_pois()`
- Pas de nouveau rôle ni changement auth.
- Pas forcément besoin de nouveau schéma : on peut réutiliser `pipeline_runs.status`, sauf si on veut garder un historique plus fin des demandes d’arrêt.

Résultat attendu après implémentation
- Un run autopipeline peut être stoppé proprement depuis l’admin.
- Le bouton `clean/merge` agit enfin sur les POIs.
- L’agent autonome devient un vrai agent d’assainissement HPP.
- Les doublons diminuent réellement.
- Les traductions EN manquantes sont comblées de façon systématique.
- La base HPP devient cohérente, propre et exploitable comme source de vérité.

