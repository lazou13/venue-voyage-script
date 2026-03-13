

## Plan : Rendre les contrôles d'enregistrement responsives sur mobile

### Problème
Sur un écran de 390px, les boutons STOP, Départ marqué/Nouveau départ et Marqueur rapide sont dans un seul `flex` horizontal (ligne 971) et débordent hors de l'écran. Le bouton "Marqueur rapide" n'est pas visible.

### Solution
Rendre le conteneur des contrôles d'enregistrement responsive avec `flex-wrap` pour que les boutons passent à la ligne sur petit écran.

### Fichier modifié : `src/components/intake/RouteReconStep.tsx`

**Ligne 971** — changer `flex items-center gap-3` en `flex flex-wrap items-center gap-2 sm:gap-3` pour permettre le retour à la ligne.

**Lignes 1013-1030** — le groupe "Départ marqué + Nouveau départ" : ajouter `flex-wrap` pour qu'il passe aussi à la ligne si nécessaire.

**Ligne 923** — le sélecteur de mode (Marche/Scooter) : ajouter `flex-wrap` pour s'adapter aux petits écrans.

**Boutons** — réduire la taille des boutons sur mobile avec `text-xs sm:text-sm` et `size="sm"` quand ce n'est pas déjà le cas, pour que STOP + Marqueur rapide tiennent sur une ligne ou se wrappent proprement.

