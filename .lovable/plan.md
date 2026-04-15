

## Plan : Exposer les colonnes audio + EN dans `public-project-data`

### Problème
HPP a bien les 26 POIs avec audio (via `pull-audio-from-questride`) et les colonnes EN (via la migration précédente), mais `public-project-data?mode=library` ne les inclut pas dans son `SELECT`. Les projets consommateurs (TTT, PRO) qui lisent cette API ne reçoivent donc ni audio ni traductions EN.

### Correction

**1 seul fichier : `supabase/functions/public-project-data/index.ts`**

Ajouter au `SELECT` du mode `library` (ligne 166, après `best_time_visit`) :

```
audio_url_fr, audio_url_en, audio_url_ar,
anecdote_audio_url_fr, anecdote_audio_url_en,
history_context_en, wikipedia_summary_en, riddle_easy_en,
must_see_details_en, must_try_en, must_visit_nearby_en,
photo_tip_en, tourist_tips, tourist_tips_en,
price_info_en, accessibility_notes_en,
best_time_visit_en, street_food_details_en
```

### Résultat
- `public-project-data?mode=library` retournera les URLs audio pour les 26+ POIs enrichis
- Les champs EN traduits seront aussi exposés
- Les projets TTT et PRO pourront les consommer immédiatement via leur sync existant

### Impact
- Aucun breaking change (ajout de colonnes uniquement)
- Déploiement immédiat de l'Edge Function

