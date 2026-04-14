

## Plan : Nettoyage des POIs non-visitables

### Constat

La base contient environ **50+ POIs** qui n'ont rien à faire dans une bibliothèque de lieux culturels visitables :

**Agences de tourisme / Tours / Guides** (~35 POIs) :
- Agafay Desert, Sahara, Desert excursions
- Atlas Morocco Tours, Planet Tours, Discover Morocco Tours...
- Quad/Buggy/Chameau rides
- Local guides, Car Hire, Transfer services

**Services non-culturels** (~10 POIs) :
- Pharmacies (4), Bureau tabac, Pressing, Supermarché Label'Vie
- Equitation Palmeraie

### Action

Une seule opération SQL via l'outil d'insertion : **désactiver** (`is_active = false`) tous ces POIs plutôt que les supprimer, pour garder une trace.

```sql
UPDATE medina_pois SET is_active = false, status = 'filtered'
WHERE is_active = true AND (
  -- Tours, agences, guides, desert
  name ILIKE '%agafay%' OR name ILIKE '%sahara%'
  OR name ILIKE '%tours%' OR name ILIKE '%tour %'
  OR name ILIKE '% guide%' OR name ILIKE '%excursion%'
  OR name ILIKE '%quad%' OR name ILIKE '%buggy%'
  OR name ILIKE '%chameau%' OR name ILIKE '%camel%'
  OR name ILIKE '%transfer%' OR name ILIKE '%car hire%'
  OR name ILIKE '%desert%'
  -- Services non-culturels
  OR name ILIKE '%pharmacie%' OR name ILIKE '%pharmacy%'
  OR name ILIKE '%tabac%' OR name ILIKE '%pressing%'
  OR name ILIKE '%supermarché%' OR name ILIKE '%equitation%'
);
```

**Exclusions protégées** (ne seront PAS touchées car le nom ne matche pas) :
- "Banksy Universe Marrakech" (contient "bank" mais filtré par `%banque%` pas `%bank%`)
- "Deserted Photo Booth" — sera touché par `%desert%`, à exclure manuellement
- Restaurants légitimes avec "Atlas" ou "Sahara" dans le nom — vérifiés au cas par cas

### Affinement

Après exécution, je vérifierai le nombre de POIs désactivés et m'assurerai qu'aucun lieu culturel légitime n'a été touché (ex: "Deserted Photo Booth" sera exclu du filtre, et les restaurants comme "Restaurant Pizzeria Aux Portes du Sahara" seront protégés).

### Résultat

~50 POIs parasites désactivés. Le dashboard et les quêtes ne les verront plus.

