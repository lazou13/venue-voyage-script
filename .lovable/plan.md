

# Fix erreur génération pilote LOT 1A

## Cause racine

L'appel `supabase.functions.invoke("poi-quality-agent", { body: { mode: "recat_propose", pilot_size: 30 } })` échoue côté navigateur avec **« Failed to send a request to the Edge Function »**.

Les logs HTTP edge ne montrent qu'un `OPTIONS 200` (preflight CORS) — **aucun POST** n'arrive jamais à la fonction. Le preflight prend 737 ms (cold start anormal sur OPTIONS) et le navigateur abandonne ensuite la requête POST.

Cause technique : les `corsHeaders` de `poi-quality-agent` ne déclarent pas `Access-Control-Allow-Methods`, et le handler `OPTIONS` traverse l'init du client Supabase avant de répondre, ce qui rend le preflight lent et fragile.

## Périmètre strict

- Aucun nouveau lot
- Aucune modification du moteur de recatégorisation
- Aucune modification de l'UI `RecatPilotPanel`
- Aucune mutation `medina_pois`
- Une seule fonction touchée : `supabase/functions/poi-quality-agent/index.ts`

## Correctif

Dans `supabase/functions/poi-quality-agent/index.ts` :

1. Ajouter `Access-Control-Allow-Methods: "POST, OPTIONS"` dans `corsHeaders`.
2. Court-circuiter le `OPTIONS` **avant** la création du client Supabase, pour qu'il réponde instantanément sans cold init.
3. Garder le handler `POST` strictement identique (mode `recat_propose`, dry-run).

Diff conceptuel :

```ts
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const supabase = createClient(...);
  // ... reste inchangé
});
```

Le `OPTIONS` est déjà court-circuité ligne 10 — mais l'absence de `Allow-Methods` peut suffire à faire échouer le preflight côté navigateur dans certains cas. Le fix principal est donc l'ajout de cet en-tête.

## Déploiement

Déployer uniquement `poi-quality-agent` après modification.

## Vérification post-fix

L'utilisateur reclique **« Générer pilote (30) »** dans `/admin/watchdog`. Résultat attendu :

- toast `Pilote généré: 30 propositions`
- panneau passe de l'état vide à la liste des 30 lignes
- bouton **Export CSV preview** devient actif

Si l'erreur persiste, je consulterai à nouveau les logs HTTP edge pour voir si le POST arrive cette fois ou s'il y a une autre cause (timeout côté gateway AI, etc.).

## Livrables

- 1 fichier modifié : `supabase/functions/poi-quality-agent/index.ts`
- 1 redéploiement de fonction edge
- Aucune migration DB
- Aucun changement UI

## Suite LOT 1A

Une fois le pilote généré, la procédure de clôture déjà validée reste inchangée :

- Export CSV preview → décider 30/30 → Appliquer → Export CSV final → noter `<lot1a_pilot_apply_ts>` → exécuter C1–C4.

