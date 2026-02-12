

## Plan : Documentation en 2 volets

### Volet 1 : Mode d'emploi dans l'admin (`/admin/docs`)

Page accessible depuis le panneau admin avec un onglet "Documentation" dans la sidebar. Contenu **fonctionnel uniquement** (pas de code source) :

- Guide utilisateur : Dashboard, Intake (6 onglets), modes de jeu, GPS
- Guide admin : Enums, Prereglages, Champs, Regles, Labels, workflow brouillon/publier
- FAQ et astuces

**Fichiers :**
- Creer `src/pages/admin/AdminDocs.tsx`
- Modifier `src/components/admin/AdminSidebar.tsx` (ajouter lien Documentation)
- Modifier `src/App.tsx` (ajouter route `/admin/docs`)

---

### Volet 2 : Dossier technique escrow (fichier telechargeable)

Un bouton dans la page Documentation permet de **telecharger un fichier ZIP** contenant la documentation technique complete, sans le code source lui-meme. Le ZIP contiendra :

- `ARCHITECTURE.md` : stack technique, structure des dossiers, schemas de la base de donnees, diagrammes de flux
- `HOOKS_AND_CONTEXT.md` : documentation de chaque hook (`useProject`, `usePOIs`, `useCapabilities`, `useAppConfig`, `useRouteRecorder`), leurs signatures, ce qu'ils font
- `TYPES_REFERENCE.md` : tous les types TypeScript documentes (QuestConfig, StepConfig, POI, BranchingLogic, etc.)
- `DATABASE_SCHEMA.md` : tables, colonnes, relations, politiques RLS
- `API_AND_EDGE_FUNCTIONS.md` : endpoints, secrets, flux d'authentification
- `DEPLOYMENT.md` : configuration, variables d'environnement, workflow de deploiement

Le fichier est genere cote client avec la librairie `jszip` (deja installee) et telecharge en `.zip`. Le contenu est ecrit en Markdown statique dans un fichier dedie.

**Fichiers :**
- Creer `src/lib/escrowDocGenerator.ts` : contient tout le contenu Markdown et la fonction `generateEscrowZip()` qui produit un Blob ZIP
- Modifier `src/pages/admin/AdminDocs.tsx` : ajouter un bouton "Telecharger le dossier technique (escrow)" qui appelle cette fonction

---

### Principe de securite escrow

- Le ZIP contient une **documentation descriptive** de l'architecture, des types et du fonctionnement
- Il ne contient **aucun fichier source** (pas de .tsx, .ts, .css)
- L'acheteur comprend comment l'application fonctionne et peut verifier sa valeur, mais ne peut pas la reproduire sans le code
- Le code source reel ne sera transmis qu'a la finalisation de la vente

### Resume des fichiers

| Fichier | Action |
|---|---|
| `src/pages/admin/AdminDocs.tsx` | Creer - page doc + bouton telechargement |
| `src/lib/escrowDocGenerator.ts` | Creer - generation du ZIP escrow |
| `src/components/admin/AdminSidebar.tsx` | Modifier - ajouter lien Documentation |
| `src/App.tsx` | Modifier - ajouter route `/admin/docs` |

