

## Fonctions supplémentaires que le LLM Expert Médina pourrait assurer

En plus de l'analyse photo/audio/GPS déjà prévue, voici les capacités additionnelles pertinentes pour votre workflow :

### 1. Génération automatique d'énigmes et QCM
À partir d'un POI analysé, le LLM peut générer directement des questions de jeu :
- QCM sur l'histoire du lieu ("En quelle année cette medersa a été fondée ?")
- Énigmes visuelles ("Comptez les colonnes de la cour intérieure")
- Défis terrain ("Trouvez la fontaine la plus proche")
- Codes secrets basés sur des détails architecturaux

### 2. Suggestion de parcours optimaux
Quand vous avez N marqueurs posés, le LLM peut :
- Proposer un ordre de visite logique (géographique + narratif)
- Estimer les temps de marche entre points
- Identifier les "trous" dans le parcours (zone non couverte)
- Suggérer des POIs manquants depuis la bibliothèque existante

### 3. Détection de doublons / POIs trop proches
Le LLM compare le nouveau marqueur avec la bibliothèque `medina_pois` existante et alerte :
- "Ce point ressemble à [POI existant] à 15m — doublon ?"
- Propose de fusionner ou enrichir le POI existant

### 4. Rédaction multilingue automatique
Au lieu de traduire après coup, le LLM produit directement les 5 langues (fr/en/ar/es/ary) pour :
- La description guide
- Le résumé bibliothèque
- Les énigmes générées

### 5. Conseils pratiques temps réel
- Horaires d'ouverture estimés ("Ce souk ferme vers 19h, les vendredis après-midi c'est calme")
- Alertes de sécurité ("Zone très fréquentée à cette heure, attention pickpockets")
- Tips photo ("Meilleur angle depuis le toit du fondouk en face")
- Accessibilité ("Passage étroit, non accessible fauteuil roulant")

### 6. Classification automatique des catégories
Au lieu de choisir manuellement la catégorie du POI, le LLM la détecte :
- souk / monument / riad / restaurant / fontaine / porte / derb / fondouk / jardin / musée / artisan

### 7. Estimation de la difficulté du point
Le LLM évalue automatiquement :
- Difficulté d'accès (facile / caché / labyrinthe)
- Niveau de connaissance requis pour les énigmes
- Intérêt pour chaque public cible (famille, ados, corporate...)

### 8. Storytelling contextuel
Le LLM peut tisser une narration continue entre les points :
- Transition narrative entre POI A et POI B
- Arc narratif global du parcours (début/milieu/fin)
- Personnage narrateur adapté à l'avatar choisi

### 9. Analyse de la photo pour les step_config
Le LLM pré-remplit les champs techniques :
- `possible_step_types` suggérés (photo → "photo", QR visible → "qr_code", etc.)
- `possible_validation_modes` adaptés au lieu
- Score de difficulté estimé

### 10. Transcription vocale enrichie
Au-delà de la simple transcription, le LLM :
- Sépare les observations terrain des réflexions personnelles
- Extrait les données structurées ("il a dit 50 dirhams" → prix: 50 MAD)
- Corrige les noms propres locaux (Semmarine, Mouassine, etc.)

---

### Impact sur le plan technique

Toutes ces fonctions peuvent être intégrées dans la **même edge function `analyze-marker`** via le tool calling — il suffit d'enrichir le schéma JSON de sortie et le prompt système. Pas de nouvelle infrastructure nécessaire.

Le prompt système passerait de ~3000 à ~5000 tokens pour couvrir toutes ces capacités, ce qui reste dans les limites du modèle `gemini-2.5-pro`.

