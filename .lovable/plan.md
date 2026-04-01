

# Créer une page dédiée "Bibliothèque de Visites"

## Problème
La bibliothèque de visites (`quest_library`) est affichée uniquement en ligne dans la card du pipeline. Il n'y a pas de page dédiée ni de lien dans la sidebar admin.

## Solution

### 1. Nouvelle page `src/pages/admin/AdminQuestLibrary.tsx`
- Liste toutes les visites de `quest_library` groupées par hub (Koutoubia, Jemaa el-Fna, Mellah)
- Chaque visite affiche : titre, description complète, audience, mode, durée, distance, nombre d'arrêts, highlights, best_time, quality_score
- Clic sur une visite = panneau d'expansion avec les stops détaillés (`stops_data`)
- Filtre par hub et par audience

### 2. Ajouter la route dans `src/App.tsx`
- Route `/admin/quest-library` → `AdminQuestLibrary`

### 3. Ajouter le lien dans `src/components/admin/AdminSidebar.tsx`
- Entrée "Bibliothèque Visites" avec icône `BookOpen` pointant vers `/admin/quest-library`

### Fichiers modifiés

| Fichier | Changement |
|---------|-----------|
| `src/pages/admin/AdminQuestLibrary.tsx` | Nouvelle page avec liste filtrée et détails des visites |
| `src/App.tsx` | Ajouter route `/admin/quest-library` |
| `src/components/admin/AdminSidebar.tsx` | Ajouter lien sidebar |

