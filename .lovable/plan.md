

# Plan : Ajouter le secret Google Places API Key + lancer le pipeline POI

## Constat
- La clé Google existe dans Google Cloud Console (screenshot : 10 API activées dont Places API)
- Le secret `GOOGLE_PLACES_API_KEY` n'est **pas** dans les secrets du projet
- Il faut l'ajouter avant de créer les edge functions du pipeline

## Étapes

### 1. Stocker le secret `GOOGLE_PLACES_API_KEY`
Utiliser l'outil `add_secret` pour demander à l'utilisateur de coller sa clé Google Maps API.

### 2. Implémenter le pipeline (plan approuvé précédemment)
Une fois le secret configuré, procéder avec :
- Migration SQL : ajouter les colonnes à `medina_pois`
- Edge functions : `poi-extract`, `poi-enrich`, `poi-proximity`, `poi-pipeline`
- Page admin : `AdminPOIPipeline`
- Routes et sidebar

