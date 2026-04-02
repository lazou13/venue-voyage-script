

# Rendre la Bibliotheque de Visites accessible sur Quest Rides Pro

## Contexte

La table `quest_library` (15 visites pre-generees) existe dans ce projet (Hunt Planner Pro). Quest Rides Pro n'a aucun acces a ces donnees. Les deux projets ont des backends separes.

## Solution en 2 parties

### Partie 1 — Exposer les donnees (ce projet)

Ajouter un mode `tours` a la edge function `public-project-data` existante.

**Fichier**: `supabase/functions/public-project-data/index.ts`

Ajouter apres le bloc `mode === "library"` un nouveau mode:

```
if (mode === "tours") {
  // Fetch quest_library with optional filters
  const audience = url.searchParams.get("audience")?.trim();
  const hub = url.searchParams.get("hub")?.trim();

  let query = sb.from("quest_library").select("*").order("quality_score", { ascending: false });
  if (audience) query = query.eq("audience", audience);
  if (hub) query = query.eq("start_hub", hub);

  const { data, error } = await query;
  if (error) throw error;
  return json({ tours: data ?? [] }, 200, cors);
}
```

Mettre a jour le message d'erreur: `"Invalid mode. Use: list, project, library, tours"`.

### Partie 2 — Consommer les donnees (Quest Rides Pro)

> Note: Cette partie necessite des modifications dans le projet Quest Rides Pro. Je vais preparer le code ici pour reference, mais l'implementation se fera dans l'autre projet.

Quest Rides Pro devra:

1. **Creer un hook `useQuestLibrary.ts`** qui appelle `https://dtwqmrmtzfhczvjggmct.supabase.co/functions/v1/public-project-data?mode=tours`
2. **Creer une page `/tours`** affichant les visites groupees par hub avec filtres audience
3. **Ajouter la route** dans App.tsx

Cependant, comme je ne peux modifier que ce projet, je vais uniquement implementer la Partie 1 (l'endpoint API). Ensuite il faudra basculer sur Quest Rides Pro pour creer la page de consultation.

## Fichiers modifies

| Fichier | Action |
|---------|--------|
| `supabase/functions/public-project-data/index.ts` | Ajouter mode `tours` pour exposer `quest_library` |

