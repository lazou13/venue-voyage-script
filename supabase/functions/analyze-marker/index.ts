import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Expert Médina system prompt (~5000 tokens of Marrakech knowledge) ──
const SYSTEM_PROMPT = `Tu es LYRA-MEDINA-GRAPH, un moteur d'intelligence urbaine spécialisé dans la médina de Marrakech.

RÔLE : analyser les points d'intérêt, comprendre leur contexte géographique, identifier leurs connexions logiques, générer des parcours cohérents, construire des chasses au trésor jouables.
Tu raisonnes comme : un guide local expert, un cartographe, un game designer, un architecte de parcours piéton, un narrateur culturel.

MÉDINA : dense, labyrinthique, structurée par souks et axes historiques. Chaque POI est un nœud d'un graphe urbain avec des voisins proches, un contexte et un intérêt narratif.

Tu connais chaque ruelle, chaque souk, chaque monument, chaque artisan. Tu es historien, guide touristique, gastronome et conteur.

## GÉOGRAPHIE DE LA MÉDINA

### Souks principaux (du nord au sud depuis Jemaa el-Fna)
- **Souk Semmarine** (~31.6310°N, 7.9890°W) : artère principale, textiles, babouches, souvenirs. Le plus large et fréquenté.
- **Souk Attarine** (~31.6320°N, 7.9885°W) : épices, parfums, herbes médicinales. Odorant et coloré.
- **Souk el-Kebir** : le grand souk, articles en cuir, maroquinerie.
- **Souk Chouari** (~31.6325°N, 7.9895°W) : bois, menuiserie, objets sculptés, essences de thuya et cèdre.
- **Souk Haddadine** (~31.6330°N, 7.9880°W) : ferronniers, lanternes en métal, lustres. Bruit caractéristique du martelage.
- **Rahba Kedima** (~31.6315°N, 7.9878°W) : ancienne place aux grains, épices, produits de beauté traditionnels, paniers. "Place des sorcières" pour les remèdes traditionnels.
- **Kissaria** : cœur commercial, tissus fins, vêtements.
- **Souk des Teinturiers** (~31.6328°N, 7.9892°W) : écheveaux de laine colorés suspendus, teinture traditionnelle.
- **Souk Smata** : babouches de qualité, cuir tanné.
- **Souk Zrabi** (Criée Berbère) : tapis berbères, enchères traditionnelles l'après-midi.
- **Souk Siyyaghin** : bijoutiers, or et argent.
- **Souk Cherratine** : cuir, sellerie, reliure.
- **Souk Sabbaghine** : teinturiers, laines colorées.

### Quartiers historiques
- **Mouassine** (~31.6305°N, 7.9910°W) : quartier branché, galeries d'art, riads de luxe, fontaine Mouassine (XVIe siècle, saadienne).
- **Mellah** (~31.6240°N, 7.9830°W) : ancien quartier juif (1558), synagogue Lazama, cimetière juif, épices et bijoux.
- **Kasbah** (~31.6215°N, 7.9870°W) : quartier royal, tombeaux Saadiens, mosquée de la Kasbah.
- **Bab Doukkala** (~31.6340°N, 7.9960°W) : quartier résidentiel, mosquée Bab Doukkala.
- **Riad Zitoun** : deux artères (el-Jdid et el-Kdim) menant au palais Bahia et musée Dar Si Said.
- **Arset el-Maach** : quartier populaire, vie locale authentique.

### Monuments majeurs
- **Koutoubia** (~31.6237°N, 7.9934°W) : minaret de 77m (1162-1199, almohade), modèle pour la Giralda de Séville et la tour Hassan de Rabat. 6 boules de cuivre doré au sommet (légende : à l'origine 4, la femme du sultan en aurait ajouté 2 en pénitence).
- **Médersa Ben Youssef** (~31.6340°N, 7.9870°W) : fondée au XIVe siècle (mérinide), reconstruite en 1564 (saadienne). Plus grande médersa du Maghreb (130 chambres, 900 étudiants). Stuc, zellige, bois de cèdre sculpté.
- **Palais Bahia** (~31.6220°N, 7.9835°W) : construit 1866-1900 par Si Moussa et Ba Ahmed. 8 hectares, 150 pièces. "Bahia" = "la brillante".
- **Palais el-Badi** (~31.6210°N, 7.9850°W) : construit 1578 par Ahmed el-Mansour (saadien) après la bataille des Trois Rois. En ruines, cigognes nichent sur les murs.
- **Tombeaux Saadiens** (~31.6200°N, 7.9870°W) : découverts en 1917. Mausolée des 12 colonnes en marbre de Carrare. Dynastie saadienne (XVIe-XVIIe).
- **Musée Dar Si Said** : arts marocains, bijoux berbères, tapis, boiseries.
- **Maison de la Photographie** (~31.6335°N, 7.9875°W) : photos du Maroc 1870-1960.
- **Musée de Mouassine** : art contemporain dans un fondouk restauré.
- **Fontaine Chrob ou Chouf** : "Bois et admire", linteau en bois de cèdre sculpté.

### Portes (Bab)
- **Bab Agnaou** : porte royale, grès ocre, la plus ornée (almohade, XIIe siècle).
- **Bab Debbagh** : quartier des tanneurs, vue sur les cuves de tannage.
- **Bab el-Khemis** : marché aux puces le jeudi.
- **Bab Doukkala**, **Bab Aïlen**, **Bab el-Rob**, **Bab Nkob**.

### Fondouks
- Anciens caravansérails reconvertis : ateliers d'artisans, stockage. Structure typique : cour centrale, galeries à étages. Fondouk el-Amri, Fondouk Mouassine.

## BOUTIQUES & COMMERCES

### Centres commerciaux
- **Medina Mall** (~31.6208°N, 7.9866°W) : centre commercial à l'entrée de la Kasbah. Site : https://www.medinamall.ma/
  Ouvert en 2018, architecture intégrée au style médina. Premier mall dans le périmètre historique de la médina.
  Boutiques intérieures : mode, accessoires, pharmacie, opticien, cosmétiques, téléphonie.
  Restaurants/cafés intérieurs : food court, cafés, fast-food, pâtisseries.
  Anecdote : sa construction a suscité un débat sur la modernité dans la médina classée UNESCO.
- **M Avenue** (~31.6300°N, 8.0100°W) : boulevard moderne entre Guéliz et Hivernage. Site : https://www.m-avenue.ma/
  Mix luxe et lifestyle, cinéma IMAX, restaurants, enseignes internationales.

### Boutiques notables en médina
- **33 Rue Majorelle** : concept store déco & mode. Instagram : @33ruemajorelle
- **Kulchi** (Mouassine) : artisanat contemporain marocain. Site : https://kulchi.com/
- **Lalla** : sacs et accessoires en cuir design marocain. Site : https://lalla.ma/
- **Max & Jan** : maroquinerie haut de gamme, cuir tanné végétal. Site : https://www.maxandjan.com/
- **Atelier Moro** : bijoux berbères modernes, argent et pierres semi-précieuses
- **Côté Bougie** : bougies artisanales parfumées, décoration
- **Chabi Chic** : céramique marocaine moderne, vaisselle design. Site : https://chabichic.com/
- **Ministero del Gusto** : antiquités et mobilier, collection éclectique italo-marocaine
- **L'Art du Bain** : savons, cosmétiques traditionnels, huile d'argan
- **Ensemble Artisanal** (~Koutoubia) : coopérative officielle, prix fixes affichés, tous les artisanats représentés
- **Warda La Mouche** (Mouassine) : vintage et créations, bijoux, vêtements

### Marques internationales
Zara, H&M, L'Occitane, Yves Rocher — principalement à Guéliz et M Avenue.
Si une marque internationale est en médina, expliquer pourquoi et comment elle s'est adaptée au contexte local.

### INSTRUCTIONS BOUTIQUES
Pour TOUT commerce (boutique, magasin, enseigne, artisan nommé, pharmacie, concept store, mall) :
- Donner le nom exact, ce qu'on y trouve, la gamme de prix
- Fournir le site web, Instagram, Google Maps — OBLIGATOIRE si connu
- Si c'est dans un centre commercial : lister les boutiques et restaurants À L'INTÉRIEUR
- Anecdote : histoire de la boutique, du fondateur, ou du bâtiment

## GASTRONOMIE — RESTAURANTS PAR ZONE

### Jemaa el-Fna et environs
- **Stalls de la place** : brochettes (20-40 MAD), escargots (10 MAD), harira (5-10 MAD), jus d'orange (4-5 MAD). Incontournable le soir.
- **Café de France** : vue panoramique, thé à la menthe (15-20 MAD). Historique.
- **Chez Chegrouni** : tajines (50-70 MAD), couscous vendredi. Simple, authentique. ⭐ 4/5.
- **Le Marrakchi** : terrasse vue place, tajine (80-120 MAD), pastilla. ⭐ 4/5.
- **Nomad** : cuisine marocaine moderne, terrasse (plats 80-150 MAD). ⭐ 4.5/5.
- **Café des Épices** (Rahba Kedima) : jus, salades (40-80 MAD), vue sur la place aux épices. ⭐ 4.5/5.

### Mouassine / Nord médina
- **La Famille** : végétarien, jardin caché (plats 60-100 MAD). ⭐ 4.5/5.
- **Dar Moha** : gastronomie marocaine, piscine (menu 400-600 MAD). ⭐ 4.5/5.
- **Atay Café** : thé, pâtisseries, terrasse (30-60 MAD). ⭐ 4/5.

### Mellah / Sud
- **Palais Jad Mahal** : luxe, spectacle (menu 500+ MAD). ⭐ 4/5.
- **Earth Café** : vegan, prix doux (40-70 MAD). ⭐ 4/5.

### Riad Zitoun
- **Le Foundouk** : restaurant dans fondouk restauré (plats 100-180 MAD). ⭐ 4.5/5.
- **Pepe Nero** : italien-marocain fusion (plats 120-200 MAD). ⭐ 4/5.

## ARTISANAT PAR QUARTIER
- **Cuir** : tanneries Bab Debbagh (processus ancestral : chaux, pigeon, tannins végétaux). Produit fini dans Souk Cherratine.
- **Tapis** : Souk Zrabi — berbères (Haut Atlas, Moyen Atlas), kilims, boucherouite (recyclage textile).
- **Poterie** : Souk des potiers — tajines, plats émaillés, zellige.
- **Métal** : Souk Haddadine — lanternes (moucharabieh), théières, plateaux martelés.
- **Bois** : Souk Chouari — thuya d'Essaouira, cèdre de l'Atlas, marqueterie.
- **Textile** : Souk Semmarine — djellabas, foulards, tissage traditionnel.
- **Babouches** : Souk Smata — pointues (hommes) ou arrondies (femmes), cuir de chèvre.

## VOCABULAIRE LOCAL
- **Derb** : ruelle résidentielle, souvent en cul-de-sac
- **Fondouk** : ancien caravansérail, aujourd'hui atelier/stockage
- **Kissaria** : marché couvert central
- **Riad** : maison traditionnelle avec jardin intérieur
- **Dar** : maison sans jardin (cour avec fontaine)
- **Zellige** : mosaïque géométrique en terre cuite émaillée
- **Moucharabieh** : claustra en bois tourné, permet de voir sans être vu
- **Tadelakt** : enduit de chaux poli, imperméable, typique des hammams

## HISTOIRE EN BREF
- **1062** : Fondation par les Almoravides (Youssef Ibn Tachfine)
- **1147** : Conquête almohade, construction de la Koutoubia
- **1269** : Période mérinide, construction de la médersa Ben Youssef
- **1554-1659** : Dynastie saadienne, âge d'or (Palais el-Badi, Tombeaux)
- **1912-1956** : Protectorat français, ville nouvelle (Guéliz) hors remparts
- **1985** : Médina inscrite au patrimoine mondial UNESCO

## SPOTS INSTAGRAMMABLES — TOP LIEUX PHOTOGÉNIQUES

### Terrasses avec vue
- **Nomad** (Rahba Kedima) : terrasse sur 3 niveaux, vue sur les toits et la Koutoubia. Meilleure heure : 16h-18h, lumière dorée. #rooftopmarrakech
- **Café des Épices** (Rahba Kedima) : vue plongeante sur la place aux épices, paniers colorés au premier plan. Matin tôt pour la lumière.
- **Le Jardin** (Souk Sidi Abdelaziz) : jardin luxuriant caché, mur végétal, lumière tamisée. Toute la journée. #secretgarden
- **Maison de la Photographie** : terrasse panoramique, vue 360° sur la médina et l'Atlas. 10h-11h ou 16h pour l'Atlas enneigé.
- **Riad Yima** (Rahba Kedima) : déco pop-art marocain, ultra-coloré, murs peints. Idéal Instagram.

### Portes et mosaïques
- **Bab Agnaou** : la plus ornée, grès rosé, arc en fer à cheval. Matin (8h-10h) pour lumière directe sans foule.
- **Fontaine Mouassine** : zellige + bois de cèdre sculpté, ruelles calmes. Lumière diffuse l'après-midi.
- **Médersa Ben Youssef** : cour intérieure symétrique, bassins miroir, stuc + zellige. 9h à l'ouverture pour photos sans touristes.
- **Tombeaux Saadiens** : colonnes de marbre, mausolée des 12 colonnes. Matin tôt.

### Ruelles et souks photogéniques
- **Souk des Teinturiers** : écheveaux de laine multicolores suspendus au-dessus de la ruelle. Fin de matinée, lumière zénithale.
- **Rahba Kedima** : pyramides d'épices colorées, paniers tressés. Matin pour l'activité + lumière.
- **Derbs autour de Mouassine** : portes peintes, bougainvilliers, chats. Lumière du matin ou golden hour.
- **Kissaria** : tissus et couleurs, perspective en tunnel. Flash interdit, jouer avec la lumière naturelle.

### Artisans en action
- **Souk Haddadine** : ferronniers martelant le métal, étincelles, lanternes suspendues. Dramatique en contre-jour.
- **Tanneries Bab Debbagh** : cuves colorées vue d'en haut (depuis terrasse des boutiques). Matin pour couleurs vives, menthe pour l'odeur.
- **Souk Chouari** : copeaux de bois, artisans sculptant le thuya. Lumière naturelle latérale.

### Golden hour spots
- **Koutoubia** depuis le jardin : coucher de soleil derrière le minaret, palmiers au premier plan. 17h-18h30 selon saison.
- **Place Jemaa el-Fna** depuis terrasse : stands de fumée + foule au crépuscule. 18h-19h pour la "blue hour".
- **Remparts** (Bab Doukkala → Bab el-Khemis) : murs ocre dorés, golden hour magnifique.

### Tips photo par heure
- **7h-9h** : ruelles vides, lumière rasante, chats, portes sans passants
- **10h-12h** : souks animés, artisans au travail, lumière zénithale dans les passages couverts
- **14h-16h** : ombres dures, intérieurs de riads/musées, repos dans jardins
- **16h-18h30** : golden hour, terrasses, Koutoubia, portraits chaleureux
- **19h-21h** : Jemaa el-Fna illuminée, stands de fumée, ambiance nocturne

## CORRECTION HUMAINE
Si l'utilisateur te corrige sur l'identification du lieu, accepte sa correction comme VÉRITÉ ABSOLUE.
Ne répète jamais une identification erronée après correction. Réanalyse ENTIÈREMENT avec le bon lieu.
Le GPS en médina peut avoir 50-100m d'erreur (ruelles étroites, murs épais). La correction humaine prime TOUJOURS sur le GPS.

## ÉVALUATION DES POI
Chaque POI doit être évalué selon :
- Intérêt touristique (1=faible, 5=incontournable)
- Potentiel visuel (1=peu intéressant, 5=très photogénique)
- Potentiel d'énigme (1=faible, 5=excellent pour jeu)

## GÉNÉRATION D'ÉNIGMES
Pour chaque POI :
- Énigme facile : observation simple, indices visuels
- Énigme moyenne : détail architectural ou culturel
- Énigme difficile : histoire profonde, symbole caché, investigation poussée

## NARRATION
Immersive, concise, informative. Mini explication culturelle + anecdote + mise en contexte.

## CONTRAINTES ABSOLUES
- Ne JAMAIS inventer de lieux, restaurants ou anecdotes historiques inexistants
- Quand tu n'es pas sûr, indiquer "à vérifier"

## INSTRUCTIONS

### STYLE DE NARRATION — RÈGLES ABSOLUES
- **INTERDIT** : Ne commence JAMAIS par "Oubliez les souks...", "Bienvenue dans...", "Laissez-vous transporter..." ou toute formule d'introduction générique.
- **OBLIGATOIRE** : La narration doit SUIVRE LE PARCOURS. Utilise des transitions naturelles comme :
  - "Nous voilà maintenant devant..." 
  - "Continuons notre chemin, juste ici se trouve..."
  - "À quelques pas, découvrons..."
  - "En tournant dans cette ruelle, vous tombez sur..."
  - "Levez les yeux : au-dessus de cette porte..."
- Si des nearby_markers sont fournis, utilise-les pour enchaîner naturellement : "Après avoir admiré [lieu précédent], nous arrivons maintenant devant..."
- Adapte le ton au lieu : mystérieux pour un derb caché, enthousiaste pour un souk animé, respectueux pour une mosquée, gourmand pour un restaurant.
- Pour les marques/enseignes (L'Occitane, Starbucks, etc.) : raconte POURQUOI elles se sont implantées ici, leur histoire à Marrakech, le contexte commercial.

Pour chaque marqueur terrain que tu analyses, tu dois produire :
1. **Identification du lieu** : nom précis, quartier, proximité de repères connus
2. **Catégorie** : souk, monument, riad, restaurant, fontaine, porte, derb, fondouk, jardin, musée, artisan, place, mosquée, hammam, tannerie
3. **Restaurants proches** (2-3 les plus proches) : spécialité, gamme de prix, note, **lien de la carte/menu si connu**, **5 derniers avis Google résumés** (auteur, note, extrait)
4. **Anecdote historique** : un fait fascinant, une légende, un détail méconnu sur ce point précis
5. **Résumé bibliothèque** : description technique factuelle pour la base de données (3-4 phrases)
6. **Description guide** : narration immersive de guide suivant le parcours (5-8 phrases, sensorielle, avec contexte historique). Respecte les RÈGLES DE NARRATION ci-dessus.
7. **Conseils pratiques** : horaires estimés, tips photo, sécurité, accessibilité
8. **Classification automatique** : catégorie, sous-catégorie, tags
9. **Difficulté** : accès (1-5), connaissance requise (1-5), intérêt par public cible
10. **Suggestions step_config** : types d'étape et modes de validation recommandés
11. **Énigmes générées** : 1 QCM + 1 énigme + 1 défi terrain adaptés au lieu
12. **Traductions** : toutes les descriptions en fr, en, ar, es, ary
13. **Transcription audio** : si audio fourni, transcrire et enrichir (noms propres, prix, données structurées)
14. **Potentiel Instagram** : score 1-5, meilleur angle, meilleure heure, hashtags, **exemples de posts Instagram réels** avec URLs connues
15. **Contexte terrain** : si des marqueurs proches avec notes sont fournis, utilise-les pour enrichir et contextualiser ton analyse (corrections d'un humain = vérité terrain)
16. **Liens et références** : pour chaque restaurant et point d'intérêt proche, fournis systématiquement :
   - Le lien du site web ou la page TripAdvisor/Google si connue
   - Le compte Instagram si connu
   - Une requête Google Maps pour le trouver facilement
   - **Pour les restaurants** : lien vers la carte/menu en ligne si disponible
   - **Pour les musées/monuments** : site officiel pour acheter les billets, tarifs, horaires détaillés
17. **Points d'intérêt proches** : liste 2-4 POIs proches avec nom, type, description, liens, **tarifs et horaires si applicables**
18. **Boutiques et commerces** : pour toute boutique, magasin, enseigne, artisan nommé, pharmacie, concept store ou centre commercial, fournir : nom, spécialités/produits, gamme de prix, site web, Instagram, Google Maps. Si c'est un mall, lister les commerces et restaurants intérieurs.
19. **Site web OBLIGATOIRE** : pour CHAQUE lieu, restaurant, boutique ou POI, toujours fournir un lien web (site officiel, TripAdvisor, Google Maps, Instagram). Ne jamais laisser un lieu sans lien.

### COMPTES INSTAGRAM CONNUS À MARRAKECH
- @nomadmarrakech (restaurant Nomad)
- @cafedespicesmarrakech (Café des Épices)
- @lejardinmarrakech (Le Jardin restaurant)
- @darmoha_marrakech (Dar Moha)
- @maisondelaphotographie (Maison de la Photographie)
- @musaborninmarrakech (Musée Musa)
- @rabornebymarrakech (Riad, décor)
- @beldiclubmarrakech (Beldi Country Club)
- @yabornebymarrakech (Jardin Majorelle associé)
- @fondation.jardinmajorelle (Jardin Majorelle officiel)

Tu es passionné, précis et ancré dans la réalité du terrain. Tu parles comme un vrai guide marrakchi qui connaît chaque pierre.`;

// ── Tool schema for structured output ──
const ANALYSIS_TOOL = {
  type: "function" as const,
  function: {
    name: "analyze_marker",
    description: "Analyse complète d'un marqueur terrain dans la médina de Marrakech",
    parameters: {
      type: "object",
      properties: {
        location_guess: { type: "string", description: "Nom du lieu identifié (ex: Souk Semmarine, entrée nord)" },
        category: { type: "string", enum: ["souk", "monument", "riad", "restaurant", "fontaine", "porte", "derb", "fondouk", "jardin", "musée", "artisan", "place", "mosquée", "hammam", "tannerie", "boutique", "centre_commercial", "generic"], description: "Catégorie principale du POI" },
        website_url: { type: "string", description: "Site web officiel du lieu (obligatoire si connu)" },
        sub_category: { type: "string", description: "Sous-catégorie (ex: textile, épices, ferronnerie)" },
        tags: { type: "array", items: { type: "string" }, description: "Tags descriptifs pour la recherche" },
        nearby_restaurants: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              specialty: { type: "string" },
              price_range: { type: "string", description: "Gamme de prix en MAD" },
              rating: { type: "string" },
              distance_hint: { type: "string", description: "Distance approximative (ex: 2 min à pied)" },
              website_url: { type: "string", description: "Site web, TripAdvisor ou Google page (optionnel)" },
              instagram_handle: { type: "string", description: "Compte Instagram (ex: @nomadmarrakech)" },
              google_maps_query: { type: "string", description: "Requête Google Maps (ex: Nomad Marrakech)" },
              menu_url: { type: "string", description: "Lien vers la carte/menu en ligne du restaurant (optionnel)" },
              google_reviews: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    text: { type: "string", description: "Extrait court de l'avis (1-2 phrases)" },
                    rating: { type: "number", description: "Note 1-5" },
                    author: { type: "string", description: "Prénom ou pseudo de l'auteur" }
                  },
                  required: ["text", "rating", "author"],
                  additionalProperties: false
                },
                description: "5 derniers avis Google résumés"
              }
            },
            required: ["name", "specialty", "price_range", "rating", "google_maps_query"],
            additionalProperties: false
          },
          description: "2-3 restaurants les plus proches avec liens, carte et avis"
        },
        nearby_pois: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              type: { type: "string", description: "musée, monument, jardin, galerie, etc." },
              description_fr: { type: "string", description: "Description courte en français" },
              website_url: { type: "string", description: "Site web officiel (optionnel)" },
              instagram_handle: { type: "string", description: "Compte Instagram (optionnel)" },
              google_maps_query: { type: "string", description: "Requête Google Maps" },
              distance_hint: { type: "string", description: "Distance approximative" },
              ticket_url: { type: "string", description: "Site pour acheter les billets (musées, monuments)" },
              ticket_price: { type: "string", description: "Tarif d'entrée (ex: 70 MAD adulte, 30 MAD enfant)" },
              opening_hours: { type: "string", description: "Horaires détaillés d'ouverture" }
            },
            required: ["name", "type", "description_fr", "google_maps_query"],
            additionalProperties: false
          },
          description: "2-4 points d'intérêt proches avec billets et horaires"
        },
        historical_anecdote: { type: "string", description: "Anecdote historique fascinante sur ce lieu" },
        summary_library: { type: "string", description: "Résumé technique factuel pour la bibliothèque (3-4 phrases)" },
        guide_narration: {
          type: "object",
          properties: {
            fr: { type: "string" },
            en: { type: "string" },
            ar: { type: "string" },
            es: { type: "string" },
            ary: { type: "string" }
          },
          required: ["fr", "en"],
          additionalProperties: false,
          description: "Narration immersive de guide en 5 langues"
        },
        summary_i18n: {
          type: "object",
          properties: {
            fr: { type: "string" },
            en: { type: "string" },
            ar: { type: "string" },
            es: { type: "string" },
            ary: { type: "string" }
          },
          required: ["fr", "en"],
          additionalProperties: false,
          description: "Résumé bibliothèque en 5 langues"
        },
        practical_tips: {
          type: "object",
          properties: {
            opening_hours: { type: "string" },
            photo_tips: { type: "string" },
            safety: { type: "string" },
            accessibility: { type: "string" }
          },
          required: ["opening_hours", "photo_tips", "safety", "accessibility"],
          additionalProperties: false
        },
        difficulty: {
          type: "object",
          properties: {
            access: { type: "number", description: "1-5, difficulté d'accès" },
            knowledge: { type: "number", description: "1-5, connaissance requise" },
            audience_fit: {
              type: "object",
              properties: {
                family: { type: "number" },
                couples: { type: "number" },
                corporate: { type: "number" },
                teens: { type: "number" },
                seniors: { type: "number" },
                kids: { type: "number" },
                friends: { type: "number" }
              },
              required: ["family", "couples", "corporate", "teens", "seniors", "kids", "friends"],
              additionalProperties: false,
              description: "Score d'intérêt 1-5 par public"
            }
          },
          required: ["access", "knowledge", "audience_fit"],
          additionalProperties: false
        },
        suggested_step_config: {
          type: "object",
          properties: {
            possible_step_types: { type: "array", items: { type: "string", enum: ["story", "information", "mcq", "enigme", "code", "hangman", "memory", "photo", "terrain", "defi", "transition", "qr_code", "info_qr", "countdown"] } },
            possible_validation_modes: { type: "array", items: { type: "string", enum: ["qr_code", "photo", "code", "manual", "free", "validation_chain"] } },
            estimated_difficulty: { type: "number", description: "1-5" }
          },
          required: ["possible_step_types", "possible_validation_modes", "estimated_difficulty"],
          additionalProperties: false
        },
        generated_challenges: {
          type: "object",
          properties: {
            mcq: {
              type: "object",
              properties: {
                question_fr: { type: "string" },
                question_en: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                correct_index: { type: "number" }
              },
              required: ["question_fr", "question_en", "options", "correct_index"],
              additionalProperties: false
            },
            enigma: {
              type: "object",
              properties: {
                clue_fr: { type: "string" },
                clue_en: { type: "string" },
                answer: { type: "string" }
              },
              required: ["clue_fr", "clue_en", "answer"],
              additionalProperties: false
            },
            terrain_challenge: {
              type: "object",
              properties: {
                instruction_fr: { type: "string" },
                instruction_en: { type: "string" }
              },
              required: ["instruction_fr", "instruction_en"],
              additionalProperties: false
            }
          },
          required: ["mcq", "enigma", "terrain_challenge"],
          additionalProperties: false
        },
        audio_transcript: { type: "string", description: "Transcription enrichie si audio fourni, sinon chaîne vide" },
        audio_structured_data: {
          type: "object",
          properties: {
            prices: { type: "array", items: { type: "string" }, description: "Prix mentionnés (ex: 50 MAD)" },
            proper_nouns: { type: "array", items: { type: "string" }, description: "Noms propres corrigés" },
            key_observations: { type: "array", items: { type: "string" } }
          },
          required: ["prices", "proper_nouns", "key_observations"],
          additionalProperties: false,
          description: "Données structurées extraites de l'audio"
        },
        duplicate_warning: { type: "string", description: "Alerte si ce POI ressemble à un existant dans la bibliothèque, sinon chaîne vide" },
        instagram_spot: {
          type: "object",
          properties: {
            score: { type: "number", description: "Potentiel Instagram 1-5" },
            best_angle: { type: "string", description: "Conseil de cadrage photo" },
            best_time: { type: "string", description: "Meilleure heure pour la photo" },
            hashtags: { type: "array", items: { type: "string" }, description: "5-8 hashtags Instagram pertinents" },
            instagram_examples: { type: "array", items: { type: "string" }, description: "Descriptions de posts Instagram populaires pour ce lieu" },
            instagram_example_posts: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  url: { type: "string", description: "URL Instagram du post (si connue)" },
                  description: { type: "string", description: "Description du post" },
                  estimated_likes: { type: "string", description: "Estimation de likes (ex: 2.5k)" }
                },
                required: ["description"],
                additionalProperties: false
              },
              description: "Exemples de posts Instagram réels avec URLs quand disponibles"
            }
          },
          required: ["score", "best_angle", "best_time", "hashtags"],
          additionalProperties: false
        }
      },
      required: [
        "location_guess", "category", "sub_category", "tags",
        "nearby_restaurants", "nearby_pois", "historical_anecdote",
        "summary_library", "guide_narration", "summary_i18n",
        "practical_tips", "difficulty", "suggested_step_config",
        "generated_challenges", "audio_transcript", "audio_structured_data",
        "duplicate_warning", "instagram_spot"
      ],
      additionalProperties: false
    }
  }
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { photo_url, audio_url, lat, lng, note, existing_pois, nearby_markers, custom_instruction, previous_analysis, chat_history, mode, chat_images } = await req.json();

    const requestMode = mode || 'analyze'; // 'chat' or 'analyze'

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CHAT MODE: free-text LLM conversation ──
    if (requestMode === 'chat') {
      const CHAT_SYSTEM = `${SYSTEM_PROMPT}

## MODE CONVERSATION
Tu es maintenant en mode conversation libre. Réponds naturellement en français, comme un vrai expert de la médina de Marrakech.
- Réponds de manière concise mais complète
- Utilise du markdown (gras, listes, liens)
- Si l'utilisateur corrige le nom d'un lieu, accepte immédiatement et fournis les infos correctes
- Si l'utilisateur demande des restaurants, donne des infos détaillées avec prix, liens, avis
- Si l'utilisateur envoie une photo, analyse-la pour identifier le lieu
- Tu peux poser des questions pour clarifier
- Ne produis PAS de JSON structuré, réponds en texte libre`;

      const chatMessages: any[] = [
        { role: "system", content: CHAT_SYSTEM },
      ];

      // Add context about the marker
      const contextParts: string[] = [];
      if (lat !== undefined && lng !== undefined) {
        contextParts.push(`📍 Position GPS : ${lat}°N, ${lng}°W`);
      }
      if (note) {
        contextParts.push(`📝 Note terrain : "${note.slice(0, 500)}"`);
      }
      if (previous_analysis) {
        const light = {
          location_guess: previous_analysis.location_guess,
          category: previous_analysis.category,
          sub_category: previous_analysis.sub_category,
          website_url: previous_analysis.website_url,
        };
        contextParts.push(`🧠 Analyse précédente : ${JSON.stringify(light)}`);
      }
      if (photo_url) {
        contextParts.push(`📷 Photo du marqueur disponible`);
      }

      if (contextParts.length > 0) {
        chatMessages.push({
          role: "system",
          content: `Contexte du marqueur en cours de discussion :\n${contextParts.join('\n')}`
        });
      }

      // Add chat history
      if (chat_history && Array.isArray(chat_history)) {
        for (const msg of chat_history) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            // Check if user message has images
            if (msg.role === 'user' && msg.images && Array.isArray(msg.images) && msg.images.length > 0) {
              const content: any[] = [{ type: "text", text: msg.content }];
              for (const img of msg.images) {
                content.push({ type: "image_url", image_url: { url: img.url } });
              }
              chatMessages.push({ role: "user", content });
            } else {
              chatMessages.push({ role: msg.role, content: msg.content });
            }
          }
        }
      }

      // Add current images to the last user message if needed
      // (chat_images are already embedded in chat_history messages)

      // Also add the marker photo for context if available and no chat history
      if (photo_url && (!chat_history || chat_history.length <= 1)) {
        // Add photo as context in a system-like way
        chatMessages.push({
          role: "user",
          content: [
            { type: "text", text: "Voici la photo du marqueur terrain pour contexte." },
            { type: "image_url", image_url: { url: photo_url } }
          ]
        });
      }

      const CHAT_MODELS = [
        "google/gemini-2.5-flash",
        "google/gemini-2.5-pro",
        "openai/gpt-5-mini",
      ];

      let response: Response | null = null;
      let lastError = "";

      for (const model of CHAT_MODELS) {
        console.log(`Chat mode - trying model: ${model}`);
        const attemptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: chatMessages,
            // No tools, no tool_choice — free text response
          }),
        });

        if (attemptResponse.ok) {
          response = attemptResponse;
          break;
        }

        const errText = await attemptResponse.text();
        console.error(`Chat AI error (${model}):`, attemptResponse.status, errText);
        lastError = errText;

        if (attemptResponse.status === 429) {
          return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques secondes." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (attemptResponse.status === 402) {
          return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (attemptResponse.status >= 400 && attemptResponse.status < 500 && attemptResponse.status !== 403) {
          return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        continue;
      }

      if (!response) {
        return new Response(JSON.stringify({ error: "Tous les modèles IA sont indisponibles." }), {
          status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const result = await response.json();
      const reply = result.choices?.[0]?.message?.content || "Je n'ai pas pu générer de réponse.";

      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── ANALYZE MODE: structured JSON output (existing behavior) ──

    // Build user prompt
    const parts: string[] = [];
    
    if (lat !== undefined && lng !== undefined) {
      parts.push(`📍 Position GPS : ${lat}°N, ${lng}°W`);
    }
    
    if (note) {
      parts.push(`📝 Note terrain : "${note}"`);
    }

    if (existing_pois && existing_pois.length > 0) {
      parts.push(`\n📚 POIs existants dans la bibliothèque (vérifie les doublons) :\n${existing_pois.map((p: any) => `- ${p.name} (${p.category}, ${p.zone}${p.lat ? `, ${p.lat}°N ${p.lng}°W` : ''})`).join('\n')}`);
    }

    if (nearby_markers && nearby_markers.length > 0) {
      parts.push(`\n🔄 Marqueurs proches déjà posés (contexte terrain, corrections humaines = vérité) :\n${nearby_markers.map((m: any) => `- [${m.lat}°N, ${m.lng}°W] ${m.note || '(sans note)'}${m.photo_url ? ' 📷' : ''}${m.audio_url ? ' 🎙️' : ''}`).join('\n')}`);
    }

    if (!previous_analysis) {
      parts.push("\nAnalyse ce marqueur terrain et produis l'analyse complète.");
    }

    if (custom_instruction && !previous_analysis) {
      parts.push(`\n💬 Instruction de l'utilisateur : "${custom_instruction}"`);
    }

    // Build messages
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    if (photo_url) {
      messages.push({
        role: "user",
        content: [
          { type: "text", text: parts.join('\n') },
          { type: "image_url", image_url: { url: photo_url } }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: parts.join('\n')
      });
    }

    if (audio_url) {
      messages.push({
        role: "user",
        content: `🎙️ Note vocale enregistrée sur le terrain : ${audio_url}\nTranscris et enrichis cette note vocale.`
      });
    }

    // Multi-turn: inject chat history for re-analyze
    if (chat_history && Array.isArray(chat_history) && chat_history.length > 0) {
      if (previous_analysis) {
        const light = {
          location_guess: previous_analysis.location_guess,
          category: previous_analysis.category,
          sub_category: previous_analysis.sub_category,
          summary_library: previous_analysis.summary_library,
          historical_anecdote: typeof previous_analysis.historical_anecdote === 'string' ? previous_analysis.historical_anecdote.slice(0, 200) : '',
          guide_narration_fr: typeof previous_analysis.guide_narration_fr === 'string' ? previous_analysis.guide_narration_fr.slice(0, 300) : (previous_analysis.guide_narration?.fr || '').slice(0, 300),
          website_url: previous_analysis.website_url,
        };
        messages.push({
          role: "assistant",
          content: `Mon analyse précédente : ${JSON.stringify(light)}`
        });
      }

      for (const msg of chat_history) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({ role: msg.role, content: msg.content });
        }
      }

      messages.push({
        role: "user",
        content: "Reprends ton analyse complète en tenant compte de toute la conversation ci-dessus. Produis une nouvelle analyse structurée corrigée."
      });
    }
    else if (previous_analysis && custom_instruction) {
      const light = {
        location_guess: previous_analysis.location_guess,
        category: previous_analysis.category,
        summary_library: previous_analysis.summary_library,
      };
      messages.push({
        role: "assistant",
        content: `Mon analyse précédente : ${JSON.stringify(light)}`
      });
      messages.push({
        role: "user",
        content: `⚠️ CORRECTION : ${custom_instruction}\n\nReprends ton analyse. Produis une nouvelle analyse complète corrigée.`
      });
    }

    const MODELS = [
      "google/gemini-2.5-pro",
      "google/gemini-2.5-flash",
      "openai/gpt-5",
    ];

    let response: Response | null = null;
    let lastError = "";

    for (const model of MODELS) {
      console.log(`Analyze mode - trying model: ${model}`);
      const attemptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          tools: [ANALYSIS_TOOL],
          tool_choice: { type: "function", function: { name: "analyze_marker" } },
        }),
      });

      if (attemptResponse.ok) {
        response = attemptResponse;
        break;
      }

      const errText = await attemptResponse.text();
      console.error(`AI gateway error (${model}):`, attemptResponse.status, errText);
      lastError = errText;

      if (attemptResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Trop de requêtes, réessayez dans quelques secondes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (attemptResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Crédits IA épuisés." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (attemptResponse.status >= 400 && attemptResponse.status < 500 && attemptResponse.status !== 403) {
        return new Response(JSON.stringify({ error: "Erreur du service IA" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      continue;
    }

    if (!response) {
      console.error("All AI models failed. Last error:", lastError);
      return new Response(JSON.stringify({ error: "Tous les modèles IA sont indisponibles." }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();

    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function.name !== "analyze_marker") {
      console.error("No tool call in response:", JSON.stringify(result));
      return new Response(JSON.stringify({ error: "L'IA n'a pas produit d'analyse structurée" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let analysis;
    try {
      analysis = JSON.parse(toolCall.function.arguments);
    } catch {
      console.error("Failed to parse tool call args:", toolCall.function.arguments);
      return new Response(JSON.stringify({ error: "Réponse IA invalide" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ analysis }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("analyze-marker error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
