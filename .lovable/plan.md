
Objectif

Corriger l’action “Anecdotes” pour qu’elle avance réellement de lot en lot, qu’elle ne donne plus l’impression de retraiter toujours les mêmes POIs, et qu’elle ne s’arrête plus au premier incident réseau.

Constat confirmé

- Dans `src/pages/admin/AdminPOIPipeline.tsx`, le bouton `Anecdotes` n’appelle pas le vrai enrichisseur d’anecdotes : il appelle `n8n-proxy` avec `action: "generate_fun_facts"`.
- Le vrai traitement d’anecdotes complètes existe déjà dans `src/components/admin/EnrichmentPipelineCard.tsx` via `anecdote-enricher`.
- La capture ne montre pas “1 seul batch” côté backend : on voit plusieurs lots réussir, puis un arrêt sur `Failed to send a request to the Edge Function`. Le problème principal est donc un mélange de :
  1. mauvais câblage UI (Anecdotes = fun facts),
  2. arrêt immédiat au moindre échec réseau,
  3. ordre de sélection pas assez stable pour rassurer visuellement.
- État actuel en base :
  - environ 421 POIs sans anecdotes complètes (`local_anecdote_en` manquant),
  - environ 663 POIs sans `fun_fact_fr`.
  Donc il y a bien 2 pipelines différents qui sont aujourd’hui confondus.

Plan de correction

1. Séparer clairement “Anecdotes” et “Fun facts”
- Renommer l’étape actuelle `fun-facts` en `Fun facts`.
- Ajouter une vraie étape `anecdotes` dans `AdminPOIPipeline.tsx`.
- Cette nouvelle étape appellera `anecdote-enricher` par lots de 5, comme dans `EnrichmentPipelineCard`.

2. Réutiliser la bonne logique de boucle
- Reprendre le pattern déjà présent dans `EnrichmentPipelineCard` pour le client-side loop.
- Le compteur de l’étape `anecdotes` devra lire `updated`.
- Le compteur de l’étape `fun-facts` devra continuer à lire `generated`.

3. Ajouter une vraie tolérance aux erreurs réseau
- Introduire un helper de retry côté page admin (`invokeWithRetry` ou équivalent).
- 3 tentatives par batch avec backoff progressif.
- Si une tentative échoue, log explicite dans les logs.
- La boucle ne s’arrête qu’après échec final du batch.

4. Stabiliser l’ordre des batches côté backend
- Dans `supabase/functions/anecdote-enricher/index.ts`, ajouter un ordre secondaire stable (`id`, ou `last_enriched_at` puis `id`).
- Dans `supabase/functions/n8n-proxy/index.ts` pour `generate_fun_facts`, ajouter aussi un ordre secondaire stable.
- But : éviter l’impression de “toujours le même lot” quand beaucoup de POIs ont le même score.

5. Retourner un indicateur de reste à traiter
- Faire renvoyer `remaining` par `anecdote-enricher` après chaque batch.
- Utiliser `remaining` / `total_remaining` dans l’UI pour afficher une progression plus lisible.

6. Corriger l’autopipeline
- Remplacer l’étape actuelle ambiguë par :
  - `anecdotes`
  - puis `fun-facts`
  - puis `translate-en`
- Ainsi, l’autopipeline suit l’ordre logique du contenu long vers le contenu court puis la traduction.

Fichiers à modifier

- `src/pages/admin/AdminPOIPipeline.tsx`
- `supabase/functions/anecdote-enricher/index.ts`
- `supabase/functions/n8n-proxy/index.ts`

Détails techniques

- Pas de migration base nécessaire.
- Le vrai enrichissement narratif reste `anecdote-enricher`.
- `generate_fun_facts` doit rester un traitement distinct, avec un libellé distinct.
- Les toasts, logs et libellés UI doivent être alignés :
  - `Anecdotes` = contenu complet,
  - `Fun facts` = phrase courte surprise.

Résultat attendu

- Le bouton `Anecdotes` traite bien les vrais POIs sans anecdote complète.
- Les lots avancent de manière déterministe.
- Une erreur réseau ponctuelle ne casse plus tout le run.
- L’interface ne mélange plus anecdotes complètes et fun facts.
- L’autopipeline enchaîne les bonnes étapes dans le bon ordre.
