

## Plan : Enrichir l'expérience client — photos, Instagram et données pratiques

### Améliorations proposées (5 axes)

---

### 1. Enrichir la base photo automatiquement lors de la promotion

**Problème** : Quand on clique "Approuver + Bibliothèque", seule la photo terrain est copiée. Aucune photo de référence (Google, Instagram) n'est associée.

**Solution** : Dans `handleApproveAndPromote`, stocker les URLs de photos Instagram/web trouvées par l'IA dans `medina_pois.metadata.reference_photos` :
- Photos Instagram populaires du lieu (URLs publiques)
- Photo Google Maps du lieu si disponible

**Fichier** : `src/components/intake/RouteReconStep.tsx` — enrichir le body envoyé à `promote-marker-to-library` avec `ai_analysis` complet, puis dans `promote-marker-to-library/index.ts`, stocker `metadata.ai_analysis` dans le POI créé.

---

### 2. Instagram : ajouter des exemples de photos réelles (URLs)

**Problème** : `instagram_examples` contient des descriptions textuelles ("Vue panoramique depuis la terrasse...") mais pas de liens vers de vrais posts.

**Solution** : Enrichir le schema `analyze-marker` :
- Ajouter `instagram_example_posts` : array d'objets `{ url, description, estimated_likes }` avec des URLs Instagram réelles connues pour le lieu
- Ajouter `instagram_reference_photos` : descriptions de types de photos qui fonctionnent bien (angles, compositions)

**Fichier** : `supabase/functions/analyze-marker/index.ts` — enrichir le schema tool + prompt

**UI** : Dans `RouteReconStep.tsx`, afficher les exemples avec liens cliquables vers Instagram.

---

### 3. Restaurants : lien carte/menu + 5 derniers avis Google résumés

**Problème** : Les restaurants n'ont pas de lien vers leur carte/menu ni d'avis.

**Solution** : Enrichir le schema `nearby_restaurants` avec :
- `menu_url` (string) — lien vers la carte en ligne (si connu)
- `google_reviews_summary` (array of `{ text, rating, author }`) — 5 avis résumés par l'IA

**Fichiers** : `analyze-marker/index.ts` (schema + prompt) + `RouteReconStep.tsx` (affichage)

---

### 4. Musées/Monuments : billetterie + infos pratiques

**Problème** : Pour les musées, pas de lien d'achat de billets ni tarifs.

**Solution** : Enrichir `nearby_pois` avec :
- `ticket_url` — site pour acheter les billets
- `ticket_price` — tarif (ex: "70 MAD adulte, 30 MAD enfant")
- `opening_hours` — horaires détaillés

**Fichiers** : `analyze-marker/index.ts` (schema) + `RouteReconStep.tsx` (affichage avec 🎫)

---

### 5. Narration de guide contextuelle (suivre le parcours)

**Problème** : Le guide commence toujours pareil avec des formules génériques.

**Solution** : Modifier le prompt système pour :
- Interdire les introductions génériques ("Oubliez les souks...")
- Imposer des transitions de parcours : "Nous voilà maintenant devant...", "À quelques pas..."
- Utiliser le contexte des `nearby_markers` pour enchaîner naturellement

**Fichier** : `supabase/functions/analyze-marker/index.ts` — section INSTRUCTIONS du prompt

---

### Résumé des fichiers modifiés

| Fichier | Modifications |
|---------|---------------|
| `supabase/functions/analyze-marker/index.ts` | Schema enrichi (menu_url, google_reviews, ticket_url, instagram posts) + prompt narration |
| `src/components/intake/RouteReconStep.tsx` | Affichage enrichi (avis, carte, billets, photos Instagram) + envoi analyse à promote |
| `supabase/functions/promote-marker-to-library/index.ts` | Accepter et stocker `ai_analysis` dans metadata |

