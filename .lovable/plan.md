

# Plan : Ajouter Histoires et Fun Facts à la couverture d'enrichissement

## Constat
Le dashboard affiche 4 métriques de couverture (Anecdotes FR, Énigmes, Wikipedia, Photos) mais omet `history_context` et `fun_fact_fr` — deux champs clés produits par Perplexity.

## Modifications

**Fichier : `src/pages/admin/AdminDashboard.tsx`**

1. Ajouter `history_context, fun_fact_fr` au SELECT de la requête sample (ligne 55)
2. Calculer `withHistory` et `withFunFact` comme les autres compteurs
3. Ajouter ces deux champs au type `Stats` et au retour de `fetchStats`
4. Ajouter deux entrées dans le tableau `enrichmentCoverage` :
   - "Histoires" → `withHistory / total`
   - "Fun Facts" → `withFunFact / total`
5. Passer la grille de 4 à 6 colonnes (`grid-cols-3 md:grid-cols-6`)

