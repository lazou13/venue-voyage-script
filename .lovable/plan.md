
## Plan : Corriger l'erreur 401 sur "Approuver + Bibliotheque"

### Diagnostic

Le token envoyé par le SDK dans la requête est le **anon key** (HS256). La fonction Edge compare ce token avec `Deno.env.get("SUPABASE_ANON_KEY")`. Bien que les valeurs semblent identiques, `getClaims()` est quand même appelé et échoue car il y a probablement une différence subtile (whitespace, encoding) entre la valeur envoyée et la variable d'environnement, OU le SDK envoie parfois le token de session ES256 (qui échoue aussi à `getClaims` dans ce contexte).

Le mode choisi est **accès ouvert** (pas de login requis). La solution la plus fiable est de supprimer toute validation d'authentification dans cette fonction, comme c'est le cas pour `analyze-marker` qui fonctionne parfaitement.

### Modification

**Fichier : `supabase/functions/promote-marker-to-library/index.ts`**

Supprimer tout le bloc d'authentification (lignes 14-64) : la vérification du header Authorization, la comparaison avec le anon key, le getClaims, et le controle du role admin. Garder uniquement le client admin (service_role) pour les operations privilegiees.

La fonction devient :
1. CORS handler (inchangé)
2. Créer le client admin avec service_role_key
3. Parser le body (marker_id, ai_analysis)
4. Exécuter la logique métier (charger marqueur, créer POI, copier médias, marquer promu)
5. Retourner le résultat

Tout le reste du code (lignes 66-250) reste identique.
