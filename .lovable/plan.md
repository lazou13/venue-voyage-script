# Forcer le hub de départ + filtrer les commerces parasites (player only)

## Problème confirmé
- `MN765V` : `options.start_address = "Place Jemaa el-Fna"` mais `route[0] = "Matich Artisanat"` (boutique).
- Étapes 5 (Maison culturelle du tapis = magasin de tapis) et 6 (Zoco Marrakech = centre commercial) n'ont rien à faire dans une visite culturelle.
- `P8HFVT` : démarre sur "Musée du Patrimoine Immatériel" au lieu de la place.
- Cause : le générateur externe `/generate-route` ne réinjecte pas le hub demandé en étape 1, et ne filtre pas les commerces non-culturels.

## Objectif
Sans toucher au backend de génération externe :
1. Forcer le hub demandé comme étape 1.
2. Retirer les commerces parasites de la route avant affichage.

## Scope
**Fichier unique modifié** : `src/lib/medinaApi.ts`. Aucune migration DB, aucun impact LYRA / review gate. Cache offline OK (transformation appliquée avant mise en cache des nouveaux tours ; pour les tours déjà cachés, le post-traitement s'applique aussi à la lecture).

## Hubs prioritaires (limités à 3)

| key | regex sur start_address normalisé | lat / lng | label FR / EN |
|---|---|---|---|
| `jemaa_el_fna` | `/(j\|dj)(e\|a)m[aâ]+a?\b.*\bel\s*fna\b/` | 31.6258 / -7.9891 | Place Jemaa el-Fna / Jemaa el-Fna Square |
| `koutoubia` | `/\bkoutoubia\b/` | 31.6242 / -7.9933 | Mosquée Koutoubia / Koutoubia Mosque |
| `place_ferblantiers` | `/\b(place\s+des\s+)?ferblantiers\b/` | 31.6206 / -7.9824 | Place des Ferblantiers / Ferblantiers Square |

Patterns d'exclusion (variantes qui NE sont PAS le hub) : `musée`, `museum`, `hotel`, `riad`, `restaurant`, `café`, `centre commercial`, `caleches`.

## Implémentation

### 1. `START_HUBS` (dictionnaire local)
Constante `Record<string, { regex; lat; lng; name_fr; name_en; photo_url?; excludeNamePatterns: RegExp[] }>` avec les 3 entrées ci-dessus. Extensible plus tard sans changement de code applicatif.

### 2. `forceStartHubAsFirstStep(raw, steps)`
1. Lire `raw.options?.start_address` (fallback `start_lat/lng`, ou `raw.summary?.start_name` côté live).
2. `matchStartHub(...)` → si aucun hub matché : no-op.
3. Si `steps[0]` est déjà le hub (nom OU distance < 80 m) : no-op.
4. Sinon :
   - Chercher le hub ailleurs dans `steps` (nom strict OU coord < 80 m), en excluant les noms qui matchent `excludeNamePatterns`.
   - Trouvé → `splice` puis `unshift` à l'index 0.
   - Non trouvé → injecter step synthétique (`name`, `lat`, `lng`, `walk_minutes=0`, `distance_m=0`, `visit_min=10`, `category="place"`, `photo_url`).
5. Recalculer `distance_m` + `walk_minutes` du nouveau step à l'index 1 (haversine vs hub, vitesse marche réutilisée de `normalizePOI`).
6. Log : `console.log("[START-HUB]", hubKey, action)` où action ∈ `moved | injected | noop`.

### 3. `filterCommerceParasites(steps)` — nouveau
Liste noire (regex insensibles à la casse, sur `name`) :
```text
matich
maison\s+culturelle\s+du\s+tapis
zoco
souk\s+el\s+bahja          # boutique commerciale, pas un site culturel
\bbazar\b
magasin\s+de\s+tapis
centre\s+commercial
\bshop\b
\bboutique\b
caleches?
```
Règle : on retire le step si son `name` matche **ET** que ce n'est pas un hub canonique de `START_HUBS` (garde-fou). Logger chaque retrait : `[FILTER-COMMERCE] removed: <name>`.

⚠️ Pour rester safe sur les visites déjà payées, la blacklist est volontairement minimaliste et ciblée sur ce qu'on a observé. Toute extension future passera par revue.

### 4. Garde sur `applyKoutoubiaSnapshotRule`
Early-return de la branche "réinsérer Jemaa après Koutoubia" si `_isJemaaElFna(out[0])` est vrai (le hub forcé ne doit jamais être déplacé).

### 5. Branchement (ordre exact)
Dans `buildTourFromMedina` :
```text
filtered  = filterCommerceParasites(filteredRaw)
ordered   = applyKoutoubiaSnapshotRule(filtered)
final     = forceStartHubAsFirstStep(raw, ordered)
```
Dans `normalizeResponse` (réponse live `/generate-route`) : même séquence si `summary.start_name` ou `params.start_name` est défini.

## Tests à exécuter

| Test | Attendu |
|------|---------|
| `/tour/MN765V` | Étape 1 = Place Jemaa el-Fna ; Matich, Maison culturelle du tapis, Zoco retirés ; route restante cohérente |
| `/tour/P8HFVT` | Étape 1 = Place Jemaa el-Fna ; le musée passe en étape 2+ |
| Visite avec `start_address = "Mosquée Koutoubia"` | Étape 1 = Koutoubia, LOT-K ne crée pas de doublon |
| Visite avec `start_address = "Place des Ferblantiers"` | Étape 1 = Ferblantiers |
| `start_address` non listé (ex. "Riad Yasmine") | Comportement inchangé (pas de hub forcé) |
| Visite sans aucun POI blacklisté | Aucun filtrage, route inchangée |
| `npx tsc --noEmit -p tsconfig.app.json` | Exit 0 |
| Console | Logs `[START-HUB] ... moved` et `[FILTER-COMMERCE] removed: ...` visibles |

## Détails techniques (récap)

**Ajouts dans `src/lib/medinaApi.ts`** :
- `START_HUBS` (3 entrées : jemaa_el_fna, koutoubia, place_ferblantiers).
- `COMMERCE_BLACKLIST: RegExp[]`.
- `matchStartHub(startAddress?, startLat?, startLng?)`.
- `filterCommerceParasites(steps): RoutePOI[]`.
- `forceStartHubAsFirstStep(raw, steps): RoutePOI[]`.
- `recomputeWalkFromPrev(step, prevLat, prevLng)`.

**Modifications** :
- `buildTourFromMedina` — chaîner filter → koutoubia rule → force hub.
- `applyKoutoubiaSnapshotRule` — early-return si Jemaa déjà en tête.
- `normalizeResponse` — même chaîne quand `summary.start_name` est défini.

## Hors scope (non fait dans ce patch)
- Recatégorisation/désactivation des POIs commerce dans HPP (`is_active=false`, recat).
- Création d'un POI canonique `Place Jemaa el-Fna` / `Place des Ferblantiers` dans `medina_pois` si absent.
- Modification du générateur externe `/generate-route`.
- Hub configurable depuis l'admin partenaire (extension future via `START_HUBS`).
