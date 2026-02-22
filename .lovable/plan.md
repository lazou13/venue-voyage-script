

## Plan : Temps total parametrable + Types POI supplementaires

### 1. Temps total editable en haut de la Fiche Projet

Actuellement le "TEMPS TOTAL XX min" dans l'en-tete violet de la Fiche Projet est un texte auto-calcule. Le transformer en champ editable :

**Fichier : `src/lib/interactiveReportGenerator.ts`**

- Remplacer le `<span id="sheet-total-time">` par un `<input>` editable dans le header de la Fiche Projet
- Ajouter un champ `totalTimeOverride` dans le STATE pour permettre a l'utilisateur de forcer une valeur
- Quand l'utilisateur modifie manuellement le temps total, il reste fixe (override). Sinon il se recalcule automatiquement
- Sauvegarder l'override dans localStorage
- Ajouter un petit bouton "reset" a cote pour revenir au calcul automatique

### 2. Ajouter les types POI manquants dans la colonne Action

Dans la colonne "Action" du tableau POI, ajouter les options demandees :

**Fichier : `src/lib/interactiveReportGenerator.ts`**

Options actuelles : Enigme, QR Code, Photo, Defi

Nouvelles options a ajouter :
- `objet_trouve` -> "Objet trouve" (chercher un objet cache)
- `final` -> "Final" (etape finale du parcours)

La colonne Action aura donc : -, Enigme, QR Code, Photo, Defi, Objet trouve, Final

### Resume des changements

| Fichier | Changement |
|---------|------------|
| `src/lib/interactiveReportGenerator.ts` | Temps total editable avec override + options Action POI supplementaires |
