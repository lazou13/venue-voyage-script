

# Fix: Timeout du backfill-details

## Probleme
La function `poi-backfill-details` timeout quand elle traite 50 POIs (chaque POI = 1 appel IA ~3-5s + 1.5s délai = ~5 min total). La connexion HTTP se ferme avant la fin.

## Solution
Reduire le `limit` de 50 a **10** dans l'appel client. La function traitera 10 POIs par clic (~30s), bien dans les limites de timeout.

## Fichier modifie

| Fichier | Changement |
|---------|-----------|
| `src/pages/admin/AdminPOIPipeline.tsx` | Ligne 95: `limit: 50` → `limit: 10` |

Chaque clic traitera 10 POIs (~30s). Pour les ~350 restants, il faudra cliquer ~35 fois, ou on pourra ajouter un mode "auto-loop" dans un second temps.

