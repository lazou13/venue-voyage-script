

## Plan : Points Instagrammables + Enrichissement des connaissances du LLM

### 1. Ajouter les spots Instagrammables

**Fichier** : `supabase/functions/analyze-marker/index.ts`

**Prompt système** — Ajouter une nouvelle section `## SPOTS INSTAGRAMMABLES` avec les lieux les plus photogéniques de la médina :
- Terrasses avec vue (Nomad, Café des Épices, Le Jardin, Maison de la Photographie)
- Portes colorées et mosaïques (Bab Agnaou, fontaine Mouassine, zellige de Ben Youssef)
- Ruelles photogéniques (Souk des Teinturiers avec laines suspendues, Rahba Kedima colorée)
- Artisans en action (ferronniers Haddadine, tanneries Bab Debbagh)
- Points dorés (Koutoubia au coucher du soleil, tombeaux Saadiens matin)
- Tips photo par heure du jour

**Tool schema** — Ajouter un champ `instagram_spot` dans la sortie JSON :
```json
{
  "instagram_spot": {
    "score": 4,           // 1-5, potentiel Instagram
    "best_angle": "...",  // conseil de cadrage
    "best_time": "...",   // heure idéale
    "hashtags": ["#medina", "#marrakech", "..."]
  }
}
```

**Instructions** — Ajouter dans les instructions du prompt : "14. **Potentiel Instagram** : score 1-5, meilleur angle, meilleure heure, hashtags suggérés"

---

### 2. Enrichir les connaissances — 3 stratégies complémentaires

#### Stratégie A : Boucle de retour terrain (immédiat, sans infra)
Quand l'admin corrige ou enrichit la note d'un marqueur après analyse IA, ces corrections sont stockées dans `route_markers.note`. Lors de l'appel à `analyze-marker`, on envoie déjà les `existing_pois` au LLM. On peut enrichir ce contexte en envoyant aussi les **marqueurs proches déjà analysés** (dans un rayon de 100m) pour que le LLM apprenne de vos corrections précédentes.

**Modification** : Dans `RouteReconStep.tsx`, lors de l'appel à `analyze-marker`, inclure les marqueurs proches du même projet avec leurs notes enrichies.

#### Stratégie B : Table `medina_knowledge` (moyen terme)
Créer une table simple pour stocker des "fiches de connaissances" que vous rédigez :
- `topic` : "Souk Semmarine", "Tanneries", "Recette pastilla"
- `content` : texte libre, anecdotes, prix mis à jour, horaires réels
- `source` : "terrain", "recherche", "local"

Ces fiches sont injectées dans le prompt comme contexte additionnel. L'admin peut les gérer via une page dédiée.

#### Stratégie C : Recherche web en temps réel (optionnel)
Connecter Perplexity ou Firecrawl pour que le LLM vérifie ses connaissances avec des données web récentes (avis Google, horaires, prix actuels). Cela se ferait en deux passes : d'abord une recherche web, puis l'analyse avec le contexte enrichi.

---

### Implémentation proposée (ce message)

On implémente la **Stratégie A** (gratuite, immédiate) + les **spots Instagram** :

1. **`analyze-marker/index.ts`** : Enrichir le prompt avec la section Instagrammable + ajouter `instagram_spot` au schema + envoyer les marqueurs proches comme contexte
2. **`RouteReconStep.tsx`** : Passer les marqueurs proches existants lors de l'appel

Pour les stratégies B et C, on pourra les ajouter ensuite si vous le souhaitez.

