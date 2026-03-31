

# Auto-loop pour le backfill-details

## Probleme
Le backfill traite 10 POIs par clic. Avec ~350+ POIs sans `price_info`, il faut cliquer 35+ fois manuellement.

## Solution
Meme pattern que l'extraction : ajouter un auto-loop dans `AdminPOIPipeline.tsx` qui relance automatiquement le backfill tant qu'il reste des POIs a traiter.

## Changement

**`src/pages/admin/AdminPOIPipeline.tsx`** — Sortir le backfill du flux generique et ajouter un auto-loop :

```typescript
if (step === "backfill-details") {
  let totalUpdated = 0;
  let round = 1;
  
  while (true) {
    setExtractionProgress({ current: totalUpdated, total: active }); // reuse progress bar
    setLogs(prev => [...prev, `📦 Backfill batch ${round}...`]);
    
    const { data, error } = await supabase.functions.invoke("poi-backfill-details", {
      body: { limit: 10 },
    });
    
    if (error) throw error;
    if (data?.logs) setLogs(prev => [...prev, ...data.logs]);
    totalUpdated += data?.updated ?? 0;
    
    // Stop if nothing left to process
    if ((data?.processed ?? 0) === 0 || (data?.updated ?? 0) === 0) break;
    
    round++;
  }
  
  setLogs(prev => [...prev, `✅ Backfill terminé — ${totalUpdated} POIs mis à jour`]);
  toast({ title: "Backfill terminé", description: `${totalUpdated} POIs enrichis.` });
  refetchStats();
  return;
}
```

La barre de progression existante sera reutilisee pour afficher l'avancement. Le loop s'arrete quand la function retourne `processed: 0` (plus de POIs sans `price_info`).

