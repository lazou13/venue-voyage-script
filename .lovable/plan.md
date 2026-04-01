

# Fix: Page admin blanche — serveur de développement bloqué

## Diagnostic

Le serveur Vite est bloqué/mort. Modifier un commentaire ne suffit pas à le relancer car le processus ne tourne plus. Il faut forcer un rebuild réel avec une modification substantielle du code.

## Solution

Effectuer une modification mineure mais réelle dans `src/App.tsx` (ajouter un `key` prop au `BrowserRouter` avec un timestamp en commentaire) pour forcer Vite à effectuer un rebuild complet du point d'entrée de l'application.

En parallèle, nettoyer `src/main.tsx` en retirant le commentaire `// Force rebuild` inutile.

| Fichier | Changement |
|---------|-----------|
| `src/App.tsx` | Ajouter un commentaire de version pour forcer un rebuild complet |
| `src/main.tsx` | Nettoyer le commentaire précédent |

Si le serveur ne redémarre toujours pas après cette modification, il faudra utiliser l'historique pour restaurer une version précédente.

