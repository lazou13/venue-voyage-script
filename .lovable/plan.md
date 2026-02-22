

## Plan : Synchronisation croisee entre les onglets Core, Parcours, Terrain et Etapes

### Contexte

Actuellement chaque onglet fonctionne de maniere independante. Les informations saisies dans un onglet ne se refletent pas dans les autres. Ce plan ajoute des mecanismes de synchronisation et des indicateurs visuels pour que les onglets se nourrissent mutuellement.

### 1. Bandeau recap en haut de chaque onglet

Ajouter un composant `CrossTabSummary` reutilisable affiche en haut de chaque onglet, montrant un resume des donnees provenant des autres onglets :

**Dans Core** :
- Nombre d'etapes definies dans Terrain (ex: "12 etapes")
- Distance totale du parcours si traces existent (ex: "3.2 km")
- Pourcentage d'etapes configurees dans Etapes (ex: "8/12 configurees")

**Dans Parcours** :
- Duree estimee saisie dans Core (ex: "Duree cible : 60 min")
- Difficulte depuis Core (ex: "Difficulte : 3/5")
- Nombre d'etapes dans Terrain (ex: "12 etapes definies")

**Dans Terrain** :
- Type de projet et quest type depuis Core
- Nombre de marqueurs importables depuis Parcours
- Nombre d'etapes sans config dans Etapes

**Dans Etapes** :
- Langues actives depuis Core
- Type de quete depuis Core (guide les types d'etapes possibles)
- Nombre d'etapes sans photo depuis Terrain

### 2. Auto-calcul de la duree dans Core

Quand la duree n'est pas saisie manuellement dans Core, elle se calcule automatiquement :
- Somme des `minutes_from_prev` de tous les POIs
- Affichage "auto-calcule" avec possibilite de forcer une valeur manuelle
- Si une trace existe, proposer aussi la duree estimee du parcours

### 3. Alerte de coherence dans Core

Ajouter des alertes non-bloquantes dans Core quand :
- Le type de projet est `route_recon` mais aucune trace n'existe dans Parcours
- Le nombre d'etapes dans Terrain ne correspond pas a la duree estimee (ex: 20 etapes pour 30 min)
- Des langues sont activees mais pas de contenu i18n dans les etapes

### Details techniques

| Fichier | Changement |
|---------|------------|
| `src/components/intake/CrossTabSummary.tsx` | Nouveau composant : bandeau de resume avec badges des donnees croisees |
| `src/components/intake/CoreStep.tsx` | Ajouter le bandeau resume + auto-calcul duree + alertes de coherence |
| `src/components/intake/RouteReconStep.tsx` | Ajouter le bandeau resume (duree cible, difficulte, nb etapes) |
| `src/components/intake/FieldworkStep.tsx` | Ajouter le bandeau resume (type projet, marqueurs importables, etapes non configurees) |
| `src/components/intake/StepsBuilderStep.tsx` | Ajouter le bandeau resume (langues, quest type, etapes sans photo) |
| `src/hooks/useProject.ts` | Ajouter un helper `useCrossTabStats()` qui calcule les statistiques croisees a partir des donnees existantes |

### Composant CrossTabSummary

```text
+---------------------------------------------------------------+
| Core: 12 etapes | 3.2 km | 8/12 config | Duree auto: 65 min  |
+---------------------------------------------------------------+
```

Un bandeau horizontal compact avec des badges colorees. Chaque badge est cliquable pour naviguer vers l'onglet source (via un callback `onNavigate`).

### Auto-calcul duree

Le champ "Duree estimee" dans Core affichera :
- Si valeur saisie manuellement : la valeur avec label "(manuel)"
- Si pas de valeur : calcul auto depuis les POIs avec label "(auto)"
- Un bouton pour basculer entre manuel et auto

