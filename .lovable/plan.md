

# Ajouter un bandeau "Mode Guidage disponible" proéminent

## Objectif

Ajouter un bandeau bleu visible entre le titre "Mode Repérage" et les contrôles, avec un bouton "Lancer le Guidage" impossible à manquer.

## Rendu visuel

```text
┌─────────────────────────────────────────────────────────┐
│ 🧭 Mode Repérage                                        │
├─────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 🧭 Mode Guidage disponible          [Lancer Guidage]│ │
│ │    2 trace(s) prête(s)                              │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ Mode: ○ 🚶 Marche  ○ 🛵 Scooter                         │
│ ...                                                     │
└─────────────────────────────────────────────────────────┘
```

## Modification technique

| Fichier | Changement |
|---------|------------|
| `src/components/intake/RouteReconStep.tsx` | Insérer bandeau bleu entre `CardHeader` (ligne 342) et `CardContent` (ligne 343) |

## Code à ajouter (après ligne 342, avant CardContent)

```typescript
{/* Bandeau Guidage proéminent */}
{traces.filter(t => t.geojson.coordinates.length >= 2).length > 0 && (
  <div className="mx-6 mb-2">
    <div className="flex items-center gap-3 p-3 rounded-md bg-blue-50 border border-blue-200">
      <Compass className="w-5 h-5 text-blue-600 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-medium text-blue-900">Mode Guidage disponible</p>
        <p className="text-xs text-blue-600">
          {traces.filter(t => t.geojson.coordinates.length >= 2).length} trace(s) prête(s)
        </p>
      </div>
      <Button 
        variant="default" 
        className="gap-2 bg-blue-600 hover:bg-blue-700"
        onClick={async () => {
          const validTraces = traces.filter(t => t.geojson.coordinates.length >= 2);
          const trace = selectedTrace && selectedTrace.geojson.coordinates.length >= 2 
            ? selectedTrace 
            : validTraces[0];
          
          const { data: traceMarkers } = await supabase
            .from('route_markers')
            .select('*')
            .eq('trace_id', trace.id)
            .order('created_at', { ascending: true });
          
          setGuidanceMarkers((traceMarkers || []) as RouteMarker[]);
          setGuidanceTrace(trace);
        }}
      >
        <Compass className="w-4 h-4" />
        Lancer le Guidage
      </Button>
    </div>
  </div>
)}
```

## Comportement

1. Le bandeau bleu n'apparaît **que si** au moins une trace a 2+ coordonnées
2. Cliquer "Lancer le Guidage" ouvre directement le mode guidage avec :
   - La trace sélectionnée (si elle a des coordonnées)
   - Sinon la première trace valide
3. Le bandeau reste visible en permanence en haut de la section

## Résultat attendu

- Bandeau bleu impossible à rater en haut de la section "Mode Repérage"
- Texte informatif "Mode Guidage disponible" + nombre de traces
- Bouton bleu "Lancer le Guidage" qui ouvre immédiatement la carte

