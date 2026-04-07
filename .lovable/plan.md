

# Plan : Couverture d'enrichissement cliquable avec édition inline

## Objectif
Rendre chaque catégorie de la couverture d'enrichissement cliquable. Au clic, un panneau s'ouvre avec la liste des POIs (manquants ou remplis) et permet l'édition directe du champ concerné.

## Approche

### 1. Nouveau composant `EnrichmentDrilldown`
Créer `src/components/admin/EnrichmentDrilldown.tsx` — un Dialog/Sheet qui :
- Reçoit en props : le champ DB à filtrer (ex: `history_context`, `local_anecdote_fr`, `fun_fact_fr`, `riddle_easy`, `wikipedia_summary`), le label, et un mode "avec/sans"
- Charge les POIs actifs filtrés (ceux où le champ est vide = à compléter, ou rempli = à vérifier)
- Affiche un tableau scrollable : Nom du POI, catégorie, contenu actuel (tronqué), bouton éditer
- Au clic sur "éditer" : ouvre un Textarea inline pour modifier le contenu
- Sauvegarde via `supabase.from('medina_pois').update(...)` au blur ou bouton "Sauvegarder"
- Toggle "Afficher manquants / remplis" pour basculer entre les deux vues

### 2. Modifier `AdminDashboard.tsx`
- Ajouter un état `drilldownField` pour tracker quel champ est ouvert
- Mapper chaque catégorie d'enrichissement à son champ DB :
  - Histoires → `history_context`
  - Anecdotes FR → `local_anecdote_fr`
  - Fun Facts → `fun_fact_fr`
  - Énigmes → `riddle_easy`
  - Wikipedia → `wikipedia_summary`
  - Photos → redirige vers `/admin/media-library`
- Rendre les cartes de couverture cliquables (cursor-pointer, hover effect)
- Ouvrir le `EnrichmentDrilldown` au clic

### 3. Fonctionnalités du panneau drill-down
- Recherche par nom de POI
- Pagination (50 POIs par page)
- Édition inline du champ texte avec Textarea auto-resize
- Badge compteur "X manquants" / "X remplis"
- Bouton pour naviguer vers la fiche complète du POI (`/admin/medina-pois`)

## Fichiers

| Fichier | Action |
|---|---|
| `src/components/admin/EnrichmentDrilldown.tsx` | Créer — Dialog avec table éditable |
| `src/pages/admin/AdminDashboard.tsx` | Modifier — cartes cliquables + état drilldown |

