

## Plan : Résoudre les conflits Git (2 fichiers)

### Contexte

Le push GitHub (38c8a744) a introduit `src/lib/externalSupabase.ts` et modifié `src/pages/HomePage.tsx` pour lire les POIs depuis le Supabase externe (xaccaoedtbwywjotqhih = QUEST RIDES PRO). Lovable n'a pas ce fichier et a sa propre version de HomePage qui utilise le client interne.

### Résolution

**1. Créer `src/lib/externalSupabase.ts`**

Créer le client secondaire pointant vers le Supabase externe PRO, conformément à la stratégie dual-backend :
```typescript
import { createClient } from '@supabase/supabase-js';

const EXTERNAL_URL = 'https://xaccaoedtbwywjotqhih.supabase.co';
const EXTERNAL_ANON_KEY = '<clé anon du projet PRO>';

export const externalSupabase = createClient(EXTERNAL_URL, EXTERNAL_ANON_KEY);
```

**2. Mettre à jour `src/pages/HomePage.tsx`**

Adopter la version GitHub : le chargement des POIs utilise `externalSupabase` au lieu du client interne. La génération de quête reste sur le client interne Lovable (`supabase.functions.invoke('generate-quest', ...)`).

Changement principal :
- Import `externalSupabase` au lieu de `supabase` pour la requête `medina_pois`
- Le reste du fichier (quest, UI) reste identique

### Note importante

Il me faudra la **clé anon** du projet externe xaccaoedtbwywjotqhih pour créer le fichier `externalSupabase.ts`. Si cette clé était déjà dans le commit GitHub, je la reprendrai telle quelle. Sinon, je vous la demanderai.

