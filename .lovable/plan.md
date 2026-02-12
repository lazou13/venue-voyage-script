

## Plan : 3 corrections

### Probleme 1 : Mode de jeu - options codees en dur

Dans `CoreStep.tsx` (ligne 345), les 4 modes de jeu sont codes en dur comme `['solo', 'team', 'one_vs_one', 'multi_solo']`. Au lieu de cela, il faut utiliser les labels dynamiques du hook `useCapabilities()` via `playModeLabels`, comme c'est deja fait pour les types de projet et les types de quete.

**Fichier** : `src/components/intake/CoreStep.tsx`
- Remplacer le tableau statique `(['solo', 'team', ...] as PlayMode[]).map(...)` par `Object.entries(playModeLabels).map(...)` pour que tous les modes definis dans l'admin soient affiches dynamiquement (y compris "famille" s'il est ajoute).

---

### Probleme 2 : Textarea des segments - impossible de mettre un espace

Dans `RouteReconStep.tsx`, les textareas (segments, danger_points, etc.) appellent `handleArrayChange` a **chaque frappe**. Cette fonction split/trim/filter et sauvegarde immediatement en base. Il n'y a pas d'etat local ni de debounce, donc chaque caractere tape provoque un re-render avec la valeur DB, ce qui "mange" les espaces et deplace le curseur.

**Correction** : Appliquer le meme pattern que `CoreStep.tsx` - ajouter un etat local par champ textarea + un debounce de 500ms avant la sauvegarde.

**Fichier** : `src/components/intake/RouteReconStep.tsx`
- Ajouter des `useState` locaux pour `segments`, `danger_points`, `mandatory_stops`, `safety_brief`
- Ajouter des `useEffect` pour synchroniser l'etat local quand les donnees serveur changent
- Creer une fonction `handleDebouncedArrayChange` (identique a celle de CoreStep) avec un `useRef` pour le timer
- Remplacer les `onChange` des textareas pour utiliser cette fonction debouncee

---

### Probleme 3 : Ajouter "Intermediaire" dans la logique de branchement

L'utilisateur veut un concept d'**etape intermediaire** dans le branchement : un moment entre 2 etapes ou on donne une direction, on fait une pause, ou on raconte une transition narrative.

**Fichier** : `src/types/intake.ts`
- Ajouter `'intermediate'` comme valeur possible dans `BranchingLogic.onSuccess` (documentation par commentaire)

**Fichier** : `src/components/intake/RulesStep.tsx`
- Ajouter `<option value="intermediate">Intermediaire (pause/direction)</option>` dans le select "En cas de succes"
- Ajouter `<option value="intermediate">Intermediaire (pause/direction)</option>` dans le select "Si au-dessus"

**Fichier** : `src/lib/outputGenerators.ts`
- Mettre a jour la fonction `getBranchingSummary` pour afficher un symbole pour "intermediate" (ex: `⏸→intermediate`)

---

### Resume des fichiers modifies

| Fichier | Modification |
|---|---|
| `src/components/intake/CoreStep.tsx` | Modes de jeu dynamiques depuis capabilities |
| `src/components/intake/RouteReconStep.tsx` | Debounce + etat local pour les textareas |
| `src/components/intake/RulesStep.tsx` | Ajout option "Intermediaire" dans branchement |
| `src/types/intake.ts` | Documentation de la valeur "intermediate" |
| `src/lib/outputGenerators.ts` | Support "intermediate" dans les exports |

