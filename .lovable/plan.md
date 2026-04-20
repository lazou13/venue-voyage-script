

## Problème
Le bouton Stop n'apparaît que si `running === 'autopipeline'` dans l'état React local. Si la page est rechargée ou ouverte dans un autre onglet pendant qu'un run tourne, l'utilisateur voit la bannière "Autopipeline en cours" mais **aucun moyen de l'arrêter**.

## Correctif

Rendre le bouton Stop visible **dès qu'un run actif existe en base**, indépendamment de l'état React local.

### Changement minimal — bannière (ligne 726)

Remplacer la condition :
```ts
(latestRun.status === 'running' || latestRun.status === 'cancel_requested') && running === 'autopipeline'
```
par :
```ts
latestRun && (latestRun.status === 'running' || latestRun.status === 'cancel_requested')
```

Et adapter `requestStop` pour qu'il fonctionne même si `activeRunId` n'est pas en mémoire : utiliser `latestRun.id` en fallback.

### Bonus UX
- Toujours afficher le Stop sur la bannière bleue (priorité visuelle).
- Garder le second bouton Stop (à côté du bouton Autopipeline) tel quel — il sert quand on lance depuis la même session.

## Fichier touché
- `src/pages/admin/AdminPOIPipeline.tsx` (≈3 lignes modifiées)

Aucun changement DB ni edge function.

