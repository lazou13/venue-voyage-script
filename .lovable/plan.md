

## Plan : Corriger le bouton Autopipeline

### Probleme
Le bouton "Autopipeline" appelle `poi-autopipeline` — une Edge Function qui **n'existe pas**. L'appel echoue systematiquement. De plus, meme si elle existait, les etapes "anecdotes" et "traduction EN" ne seraient pas incluses car elles ne font pas partie de l'orchestrateur `enrichment-pipeline`.

### Solution
Remplacer la logique du bouton "Autopipeline" pour qu'il execute sequentiellement toutes les etapes existantes dans l'ordre, en reutilisant la fonction `runStep()` deja en place. Cela appelle les vraies Edge Functions une par une.

### Modifications

**Fichier : `src/pages/admin/AdminPOIPipeline.tsx`**

1. Creer une fonction `runAutopipeline()` qui execute sequentiellement :
   - `extract` → `classify` → `enrich` → `clean` → `merge` → `proximity` → `backfill-details` → `fetch-photos` → `fun-facts` → `translate-en`
   - Chaque etape met a jour les logs et `stepResult`
   - Si une etape echoue, log l'erreur et continue a la suivante

2. Modifier le bouton Autopipeline pour appeler `runAutopipeline()` au lieu de `runStep("autopipeline")`

3. Supprimer la reference a `poi-autopipeline` dans le mapping `fnName`

### Detail technique

```typescript
const runAutopipeline = async () => {
  const steps: StepKey[] = [
    "extract", "classify", "enrich", "clean", "merge", 
    "proximity", "backfill-details", "fetch-photos", 
    "fun-facts", "translate-en"
  ];
  setRunning("autopipeline");
  for (const step of steps) {
    setLogs(prev => [...prev, `🔄 Autopipeline — étape: ${step}...`]);
    try {
      await runStep(step); // refactorer runStep pour ne pas gerer running/finally
    } catch (e) {
      setLogs(prev => [...prev, `⚠️ ${step} échoué, passage à la suite`]);
    }
  }
  setRunning(null);
  toast({ title: "Autopipeline terminé" });
};
```

Cela necessite un leger refactoring de `runStep` pour extraire la logique d'execution sans le `setRunning`/`finally`, ou bien appeler directement chaque branche inline.

