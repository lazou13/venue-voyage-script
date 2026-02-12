
## Plan : Categories de projet configurables depuis l'admin

### Objectif
Rendre les types de projet (et leur label de nom associe) entierement parametrables depuis le back-office admin, puis utiliser ces donnees dans un dialogue de creation de projet.

### Ce qui existe deja
- L'enum `project_types` est deja geree dans le back-office admin (page `/admin/enums`) avec des items `{id, label}`.
- Les 3 types actuels : `establishment` (Etablissement), `tourist_spot` (Site Touristique), `route_recon` (Reconnaissance Parcours).
- Le hook `useCapabilities()` fournit ces enums au front-end.

### Ce qui manque
- Un champ supplementaire par type de projet pour definir le **label du nom** (ex: "Nom de l'hotel", "Nom du client", "Nom du lieu").
- Un dialogue de creation de projet qui utilise ces donnees dynamiques.
- L'edition inline du titre/ville dans le formulaire intake.

---

### Etape 1 : Enrichir la structure `EnumItem` pour les project_types

Ajouter un champ optionnel `name_label` a l'interface `EnumItem` dans `useCapabilities.ts`, utilise uniquement par `project_types` :

```text
EnumItem {
  id: string       // ex: "establishment"
  label: string    // ex: "Etablissement"  
  name_label?: string  // ex: "Nom de l'hotel"
}
```

Aucune migration DB necessaire : le champ JSONB `payload` accepte deja n'importe quelle structure.

### Etape 2 : Adapter l'EnumEditor pour project_types

Modifier `EnumEditor.tsx` pour accepter une prop optionnelle `extraField` (label + placeholder). Quand elle est presente, un champ supplementaire s'affiche par item pour saisir le `name_label`.

Dans `AdminEnums.tsx`, passer cette prop uniquement pour la definition `project_types`.

### Etape 3 : Creer le composant `CreateProjectDialog.tsx`

Nouveau fichier `src/components/CreateProjectDialog.tsx` :
- Utilise `useCapabilities()` pour lire dynamiquement la liste des types de projet.
- Affiche les types sous forme de cartes selectionnables (icone + label).
- Champ "Nom" dont le placeholder s'adapte au `name_label` du type selectionne.
- Champ "Ville / Lieu".
- Bouton "Creer" qui insere dans `projects` avec `hotel_name`, `city`, et `quest_config: { project_type }`.
- Redirige vers `/intake/:id`.

### Etape 4 : Modifier Dashboard.tsx

- Remplacer l'appel direct `createProject.mutate()` par l'ouverture du `CreateProjectDialog`.
- Supprimer la mutation inline.

### Etape 5 : Rendre le titre et la ville editables dans IntakeForm.tsx

- Remplacer le `<h1>` statique par un `<input>` inline editable pour le nom du projet.
- Ajouter un petit input pour la ville.
- Sauvegarder en DB au blur (debounce).

### Etape 6 : Mettre a jour le payload admin existant

Ajouter les `name_label` aux 3 types existants dans la configuration publiee :
- `establishment` → "Nom de l'etablissement"
- `tourist_spot` → "Nom du site"  
- `route_recon` → "Nom du parcours"

---

### Resume des fichiers modifies
| Fichier | Action |
|---|---|
| `src/hooks/useCapabilities.ts` | Ajouter `name_label?` a `EnumItem` |
| `src/components/admin/EnumEditor.tsx` | Ajouter support champ extra par item |
| `src/pages/admin/AdminEnums.tsx` | Passer `extraField` pour `project_types` |
| `src/components/CreateProjectDialog.tsx` | **Nouveau** - dialogue de creation |
| `src/pages/Dashboard.tsx` | Utiliser le dialogue au lieu de la mutation directe |
| `src/pages/IntakeForm.tsx` | Titre et ville editables inline |

### Comportement attendu
1. **Admin** : dans Enums > Types de projet, chaque item a un champ "Label du nom" editable. On peut ajouter/supprimer des types librement.
2. **Dashboard** : clic "Nouveau Projet" ouvre un dialogue avec les types disponibles (dynamiques), un champ nom adaptatif, et un champ ville.
3. **Intake** : le titre et la ville sont editables directement dans le header.
