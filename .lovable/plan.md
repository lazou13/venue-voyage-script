

## Nettoyer la bibliothèque de visites

### Résumé
Supprimer toutes les 15 entrées de la table `quest_library` pour repartir de zéro.

### Database Changes
Migration SQL :
```sql
DELETE FROM quest_library;
```

### Code Changes
Aucun changement de code nécessaire — la page admin affiche déjà dynamiquement le contenu de la table.

