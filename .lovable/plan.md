
# Activer l'enregistreur GPS pour tous

## Probleme identifie

L'enregistreur GPS (boutons REC/STOP, marqueurs rapides, etc.) dans l'onglet "Parcours" est cache derriere une condition:

```typescript
const isAdminMode = import.meta.env.VITE_ADMIN_MODE === 'true';

{isAdminMode && (
  // Tout l'enregistreur GPS ici
)}
```

La variable `VITE_ADMIN_MODE` n'est pas definie dans `.env`, donc l'enregistreur n'apparait jamais.

## Solution

Supprimer la condition `isAdminMode` pour afficher l'enregistreur GPS a tous les utilisateurs.

## Modifications

| Fichier | Changement |
|---------|------------|
| `src/components/intake/RouteReconStep.tsx` | Supprimer la ligne `const isAdminMode = ...` et la condition `{isAdminMode && (...)}` autour de la section GPS |

## Details techniques

**Avant (lignes 51, 324-325):**
```typescript
const isAdminMode = import.meta.env.VITE_ADMIN_MODE === 'true';
// ...
{isAdminMode && (
  <Card className="border-primary/50 bg-primary/5">
```

**Apres:**
```typescript
// Supprime la variable isAdminMode
// Affiche directement la Card sans condition
<Card className="border-primary/50 bg-primary/5">
```

## Resultat attendu

- L'onglet "Parcours" affichera:
  - Section "Mode Reperage" avec selecteur Marche/Scooter
  - Bouton REC pour demarrer l'enregistrement GPS
  - Bouton "Marqueur rapide" pendant l'enregistrement
  - Stats en direct (duree, distance, points)
  - Liste des traces enregistrees avec export GeoJSON/CSV

## Test

1. Aller sur `/intake/{projectId}` avec un projet de type `route_recon`
2. Cliquer sur l'onglet "Parcours"
3. Verifier que la section "Mode Reperage" avec bouton REC est visible
4. Tester l'enregistrement GPS
