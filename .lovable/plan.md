

# Diagnostic : Pourquoi un seul marqueur est visible

## Constat

La base de données ne contient **qu'un seul marqueur** (le "Parvis de la Koutoubia" sur la trace 27341a49). Les 5 traces GPS existent, mais aucun autre marqueur n'a été persisté. Ce n'est pas un problème d'affichage — les points n'ont simplement pas été enregistrés en base.

## Cause probable

Le bouton "Marqueur rapide" (le moyen principal d'ajouter des points sur le terrain) n'est disponible que **pendant un enregistrement actif**. Voici le scénario probable :

1. Vous avez lancé l'enregistrement (trace 1), marqué le départ (Koutoubia) → **sauvegardé OK**
2. Vous avez stoppé l'enregistrement, puis relancé (trace 2, 3, 4, 5)
3. Entre les arrêts/redémarrages, ou si le GPS était indisponible, les tentatives de marquage ont échoué silencieusement

Le problème principal : **quand une sauvegarde de marqueur échoue, l'erreur peut ne pas être visible** si le toast disparaît rapidement ou si le navigateur est en arrière-plan.

## Plan de correction

### 1. Afficher les marqueurs de TOUTES les traces (pas seulement la trace sélectionnée)
Actuellement, les marqueurs ne s'affichent que pour la trace sélectionnée. Modifier la section "Marqueurs" pour agréger les marqueurs de toutes les traces du projet, avec un indicateur de trace pour chacun.

### 2. Permettre d'ajouter des marqueurs même sans enregistrement actif
Ajouter un bouton "Marqueur rapide" accessible hors enregistrement, qui utilise la géolocalisation du navigateur et crée/réutilise une trace automatiquement.

### 3. Renforcer le feedback d'erreur
- Ajouter un toast persistant (pas auto-dismiss) en cas d'échec de sauvegarde de marqueur
- Ajouter un indicateur visuel de confirmation plus visible (vibration, son, animation)

### 4. Ajouter un compteur global de marqueurs dans l'en-tête
Afficher "X marqueurs total" en haut de la page, pas seulement par trace, pour que l'utilisateur voie immédiatement si ses points ont été sauvegardés.

## Fichiers impactés
- `src/components/intake/RouteReconStep.tsx` — affichage agrégé des marqueurs + bouton hors-recording
- `src/hooks/useRouteRecorder.ts` — nouvelle méthode pour ajouter un marqueur sans recording actif

