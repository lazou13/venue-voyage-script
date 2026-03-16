

## Plan : Enrichir l'IA pour toutes les boutiques et commerces

### Problème
Le prompt IA ne couvre que les souks (de manière générique) et les restaurants. Il manque les **boutiques individuelles** : marques, enseignes, artisans nommés, concept stores, pharmacies, bazars, centres commerciaux. Et le champ `website_url` n'existe pas au niveau racine de l'analyse.

### Corrections

#### 1. Enrichir le `SYSTEM_PROMPT` — nouvelle section "Boutiques & Commerces"

**Fichier : `supabase/functions/analyze-marker/index.ts`**

Ajouter après la section "Fondouks" (ligne 55) :

```
## BOUTIQUES & COMMERCES

### Centres commerciaux
- **Medina Mall** (~31.6208°N, 7.9866°W) : centre commercial à l'entrée de la Kasbah. Site : https://www.medinamall.ma/
  Ouvert en 2018. Restaurants intérieurs, boutiques mode, pharmacie, café. Premier mall dans le périmètre historique.
- **M Avenue** (~31.6300°N, 8.0100°W) : boulevard moderne. Site : https://www.m-avenue.ma/

### Boutiques notables en médina
- **33 Rue Majorelle** : concept store déco & mode
- **Kulchi** (Mouassine) : artisanat contemporain marocain
- **Lalla** : sacs et accessoires en cuir design
- **Max & Jan** : maroquinerie haut de gamme
- **Atelier Moro** : bijoux berbères modernes
- **Côté Bougie** : bougies artisanales parfumées
- **Chabi Chic** : céramique marocaine moderne
- **Ministero del Gusto** : antiquités et mobilier
- **L'Art du Bain** : savons et cosmétiques traditionnels
- **Ensemble Artisanal** (~Koutoubia) : prix fixes, artisans officiels

### Marques internationales présentes
Zara, H&M, L'Occitane, Yves Rocher — principalement à Guéliz et M Avenue.
Si une marque internationale est en médina, expliquer pourquoi et comment elle s'est adaptée.

### INSTRUCTIONS BOUTIQUES
Pour TOUT commerce (boutique, magasin, enseigne, artisan nommé, pharmacie, concept store, mall) :
- Donner le nom exact, ce qu'on y trouve, la gamme de prix
- Fournir le site web, Instagram, Google Maps
- Si c'est dans un centre commercial : lister les boutiques et restaurants À L'INTÉRIEUR
- Anecdote : histoire de la boutique, du fondateur, ou du bâtiment
```

#### 2. Ajouter la catégorie `boutique` + `centre_commercial` au schema

Ligne 212, ajouter à l'enum `category` : `"boutique"`, `"centre_commercial"`

#### 3. Ajouter `website_url` au schema racine

Ajouter un champ `website_url` à l'objet racine du tool schema (à côté de `location_guess`) :
```json
website_url: { type: "string", description: "Site web officiel du lieu (obligatoire si connu)" }
```

#### 4. Mettre à jour les instructions (ligne 164-186)

Ajouter une instruction 18 :
```
18. **Boutiques et commerces** : pour toute boutique, magasin, enseigne, artisan nommé, pharmacie, concept store ou centre commercial, fournir : nom, spécialités/produits, gamme de prix, site web, Instagram, Google Maps. Si c'est un mall, lister les commerces et restaurants intérieurs.
```

Modifier l'instruction existante sur les liens (16) pour ajouter :
```
- **Pour les boutiques** : site web ou page Instagram, produits phares, gamme de prix
```

#### 5. Afficher `website_url` dans la note enrichie

**Fichier : `src/components/intake/MarkerDetailSheet.tsx`**

Dans `buildEnrichedNote`, ajouter après la ligne `📂 catégorie` :
```typescript
if (a.website_url) parts.push(`🌐 ${a.website_url}`);
```

### Fichiers modifiés
- `supabase/functions/analyze-marker/index.ts` — prompt + schema
- `src/components/intake/MarkerDetailSheet.tsx` — affichage website_url

