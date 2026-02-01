

# Plan: Créer un Rapport Interactif Fictif Standalone

## Objectif
Créer un fichier HTML autonome dans `public/` qui affiche un exemple complet du rapport interactif avec :
- Carte Leaflet avec 5 points de trace
- 3 marqueurs POI (danger, arrêt obligatoire, POI standard)
- Panneau de configuration (transport, vitesse, joueurs)
- Calculs de temps en temps réel
- Bouton d'export PDF (print)

## Données fictives

### Trace (5 points - Marrakech Médina)
```
Coordonnées [lng, lat]:
1. [-7.9898, 31.6295] - Place Jemaa el-Fna
2. [-7.9880, 31.6280] - Rue des Souks
3. [-7.9860, 31.6270] - Fontaine historique
4. [-7.9845, 31.6255] - Riad Ben Youssef
5. [-7.9830, 31.6240] - Bab Agnaou

Distance totale: ~850m
```

### Marqueurs (3 POIs)
| # | Type | Coordonnées | Note |
|---|------|-------------|------|
| 1 | departure | 31.6295, -7.9898 | Point de départ - Place Jemaa el-Fna |
| 2 | danger | 31.6270, -7.9860 | Danger: Circulation dense, traversée difficile |
| 3 | mandatory_stop | 31.6240, -7.9830 | Stop: Photo obligatoire devant Bab Agnaou |

## Fichier à créer

### `public/exemple-rapport-interactif.html`
- Fichier HTML autonome (~400 lignes)
- Reprend le template exact de `generateInteractiveReportHTML()`
- Données fictives injectées en dur
- Accessible directement via `/exemple-rapport-interactif.html`

## Fonctionnalités du rapport exemple

1. **En-tête**
   - Titre: "Parcours Découverte Médina"
   - Ville: Marrakech, Maroc
   - Bouton PDF (lance window.print())

2. **Panneau de configuration**
   - Transport: Marche/Scooter/Voiture
   - Vitesse: ajustable (km/h)
   - Joueurs: nombre

3. **Carte Leaflet**
   - Tuiles OpenStreetMap
   - Polyline bleue reliant les 5 points
   - Marqueur vert au départ
   - Marqueur rouge à l'arrivée
   - 3 popups POI avec emojis

4. **Statistiques**
   - Distance: 850m
   - Temps trajet: ~10 min (marche 5km/h)
   - Temps arrêts: 5 min
   - Temps total: 15 min

5. **Tableau POIs**
   - 3 lignes avec type modifiable
   - Temps d'arrêt éditable
   - Recalcul en temps réel

## Accès après création

URL directe: `https://id-preview--e131f396-539f-4ffb-9d93-c4a26474fc14.lovable.app/exemple-rapport-interactif.html`

## Tests à effectuer après création

1. Ouvrir l'URL et vérifier que la carte Leaflet s'affiche
2. Changer le mode de transport -> vitesse mise à jour
3. Modifier les temps d'arrêt -> temps total recalculé
4. Cliquer sur les marqueurs -> popups visibles
5. Cliquer PDF -> dialogue d'impression

