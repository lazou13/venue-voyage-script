

## Diagnostic

La médiathèque charge actuellement **toutes** les photos de **tous** les projets en une seule requête, sans pagination ni filtre par projet. Avec 44 markers et 38 photos c'est encore gérable, mais c'est effectivement conçu pour ne pas tenir à l'échelle : chaque nouveau client ajoutera ses photos au même pool.

L'écran "Erreur d'affichage" (2e screenshot) est probablement un crash React dû au chargement simultané de toutes les images ou à un problème de rendu.

### Problèmes identifiés

1. **Pas de pagination** : toutes les photos sont chargées et rendues d'un coup
2. **Pas de filtre par projet** : un admin voit les photos de TOUS les clients mélangées
3. **Pas de virtualisation** : 38+ `<img>` rendues simultanément dans le DOM
4. **Le champ `note` (rich text)** est chargé pour chaque marker alors qu'on n'en affiche qu'une ligne tronquée
5. **Import lourd** : `JSZip` est importé en dur alors qu'il n'est utilisé qu'au téléchargement

## Plan de correction

### 1. Ajouter la pagination serveur
- Requête paginée (50 photos par page) avec `.range(from, to)` sur `route_markers`
- Boutons "Page suivante / précédente" ou scroll infini
- Conserver le tri par date décroissant

### 2. Ajouter un filtre par projet
- Ajouter un sélecteur de projet en plus du filtre par trace
- Requête filtrée côté serveur : `.eq('route_traces.project_id', selectedProject)`
- Par défaut : afficher uniquement le projet en cours ou le plus récent

### 3. Alléger la requête
- Retirer le champ `note` de la requête principale (ou le tronquer via une vue)
- Ne sélectionner que les colonnes nécessaires pour la grille

### 4. Lazy-load JSZip
- Remplacer `import JSZip from 'jszip'` par un `await import('jszip')` dynamique dans la fonction `downloadZip`
- Réduit le bundle initial de la page

### 5. Virtualiser la grille (optionnel mais recommandé)
- Utiliser une technique de virtualisation ou simplement limiter le rendu aux photos visibles
- Alternative simple : la pagination (point 1) résout déjà le problème si les pages restent à 50 items

### Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/pages/admin/AdminMediaLibrary.tsx` | Pagination, filtre projet, requête allégée, lazy-load JSZip |

