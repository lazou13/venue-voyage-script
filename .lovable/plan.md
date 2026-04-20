

## Compréhension

Tous les POIs doivent afficher leur nom en français par défaut dans l'admin (et partout où ils s'affichent), sans exception. Aujourd'hui, la colonne `name` contient un mélange (anglais OSM, transcriptions arabes, français…), et `name_fr` n'est rempli que pour une partie.

## Vérifications rapides

Avant action :
- `SELECT count(*) FROM medina_pois WHERE name_fr IS NULL OR name_fr = '';`
- `SELECT count(*) FROM medina_pois WHERE name_fr IS NOT NULL AND name_fr <> name;` (combien diffèrent)
- Échantillon de 30 noms `name` vs `name_fr` pour cibler les patterns à traduire (Mosque→Mosquée, Garden→Jardin, Tomb→Tombeau, Palace→Palais, Gate→Bab, Square→Place, Fountain→Fontaine, Madrasa/Medersa, Souk…).

## Plan

### 1. Backfill `name_fr` (INSERT tool — données)
Stratégie en cascade, sans écraser ce qui est déjà bon :

**Étape A — Mappings déterministes** (couvre 80 % des cas) :
Remplacements regex côté SQL sur `name` quand `name_fr` est vide :
- `Mosque` → `Mosquée`, `Madrasa|Medersa` → `Médersa`, `Palace` → `Palais`, `Garden(s)?` → `Jardin(s)`, `Tomb(s)?` → `Tombeau(x)`, `Gate` → `Bab`, `Square` → `Place`, `Fountain` → `Fontaine`, `Museum` → `Musée`, `Market` → `Marché`, `Tannery|Tanneries` → `Tanneries`, `Hammam` → `Hammam`, `Fondouk|Funduq` → `Fondouk`, `Souk|Souq` → `Souk`, `of `→ `de `, `the `→ `` (en début), apostrophes ASCII normalisées.
- Whitelist d'incontournables forcés : Koutoubia, Jemaa el-Fna, Médersa Ben Youssef, Palais Bahia, Palais El Badi, Tombeaux Saadiens, Jardin Majorelle, Le Jardin Secret, Dar Si Said, Maison de la Photographie, Musée de Marrakech, Bab Agnaou, Place des Épices (Rahba Kedima), Mosquée Ben Salah, Mosquée Mouassine, Koubba Almoravide, Tanneries, Menara, Agdal, Mellah, Souk Semmarine / Attarine / Smata / Cherratine / Sebbaghine / Haddadine / Chouari / Kimakhine / Zrabi / Kchachbia.

**Étape B — Fallback** : pour les POIs qui restent sans `name_fr` après A, copier `name` dans `name_fr` (mieux qu'un vide), puis les marquer `metadata.fr_name_needs_review = true` pour traitement IA ultérieur.

**Étape C — `name` = `name_fr`** (la vraie demande) : `UPDATE medina_pois SET name = name_fr WHERE name_fr IS NOT NULL AND name_fr <> '';`
Ainsi la colonne `name` (utilisée partout dans l'UI) est en FR par défaut, conformément à la demande.

### 2. Politique côté code (FR-first à l'affichage)
Petit helper `getDisplayName(poi)` retournant `name_fr || name` — branché dans :
- `AdminMedinaPOIs.tsx` (liste + entête de fiche)
- `MedinaMap.tsx` (popups)
- `BilingualNarrativeBlock.tsx` (titre)
- `api-v2` route `main-visits` : exposer `display_name = name_fr || name` en plus de `name` et `name_en`.

### 3. Garde-fou nouveau POI
Dans `useMedinaPOIs.create`, si `name_fr` n'est pas fourni → le remplir avec `name`. Et `name` devient `name_fr` en source.

### 4. Mémoire
Mettre à jour `mem://features/poi-library/naming-policy-latin-only` avec : politique FR-first, ordre de fallback `name_fr → name → name_en`, helper `getDisplayName`.

## Fichiers touchés

- INSERT (data) : backfill `name_fr` + alignement `name = name_fr`
- `src/lib/poiDisplay.ts` (nouveau, helper `getDisplayName`)
- `src/pages/admin/AdminMedinaPOIs.tsx` — liste + titre fiche
- `src/components/admin/MedinaMap.tsx` — popups
- `src/components/admin/medina/BilingualNarrativeBlock.tsx` — titre
- `src/hooks/useMedinaPOIs.ts` — defaut `name_fr` à la création
- `supabase/functions/api-v2/index.ts` — `display_name` dans `main-visits`
- `mem://features/poi-library/naming-policy-latin-only.md`

Aucune migration de schéma. Aucun nouvel index. Pas de nouvelle dépendance.

