

## Plan : Temps trajet editable + Export HTML depuis le rapport

### Probleme 1 : TEMPS TRAJET non modifiable

Dans la section "Infos Parcours > Timing", les champs "Temps trajet" et "Temps arrets" sont des `<div>` en lecture seule. Il faut les rendre editables comme le temps total.

### Probleme 2 : Export HTML avec les modifications

Actuellement le bouton "Telecharger HTML" est dans l'app React (avant d'ouvrir le rapport). Les modifications faites dans le rapport ouvert ne sont pas incluses. Il faut ajouter un bouton "Telecharger HTML" directement dans le rapport ouvert, qui exporte le HTML avec l'etat actuel (STATE) integre.

### Changements dans `src/lib/interactiveReportGenerator.ts`

#### 1. Rendre TEMPS TRAJET et TEMPS ARRETS editables

- Ligne ~1151 : Remplacer le `<div class="sheet-field-value" id="meta-travel">` par un `<input>` editable avec override (meme logique que le temps total)
- Ligne ~1155 : Remplacer le `<div class="sheet-field-value" id="meta-stops">` par un `<input>` editable avec override
- Ajouter `STATE._travelTimeOverride` et `STATE._stopTimeOverride` dans la logique
- Quand l'utilisateur modifie manuellement ces champs, la valeur reste fixe
- Ajouter des boutons reset pour revenir au calcul automatique
- Mettre a jour `recalculate()` pour respecter ces overrides
- Mettre a jour `applyStateToDOM()` pour restaurer les overrides

#### 2. Bouton "Telecharger HTML" dans le rapport ouvert

- Ajouter un bouton "HTML" dans la barre d'export du rapport (a cote de PDF, JSON, Word) — ligne ~908-912
- La fonction `exportHTML()` reconstruit le HTML complet avec le STATE actuel injecte dans les donnees initiales, pour que le fichier telecharge contienne toutes les modifications
- Le fichier est telecharge avec le nom `rapport-<nom_projet>.html`

### Resume

| Fichier | Changement |
|---------|------------|
| `src/lib/interactiveReportGenerator.ts` | Inputs editables pour temps trajet/arrets + bouton export HTML dans le rapport |

