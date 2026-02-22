

## Plan : Traduction automatique par IA au clic sur un onglet langue

### Objectif
Quand l'utilisateur clique sur un onglet de langue (autre que le francais), si le champ est vide et que le texte francais existe, une traduction automatique est lancee via Lovable AI. Le resultat apparait directement dans le champ de la langue selectionnee.

### Comment ca marche

1. L'utilisateur remplit le texte en francais
2. Il clique sur l'onglet "English" (ou autre langue)
3. Si le champ est vide et que le francais est rempli :
   - Un indicateur de chargement s'affiche ("Traduction en cours...")
   - La traduction est generee automatiquement par l'IA
   - Le texte traduit apparait dans le champ
4. L'utilisateur peut modifier la traduction si necessaire

### Fichiers a creer

**1. `supabase/functions/translate/index.ts`**
- Edge function qui appelle Lovable AI (Gemini Flash) pour traduire un texte
- Parametres : `text` (texte source), `from` (langue source), `to` (langue cible)
- Retourne le texte traduit, sans streaming (appel simple)
- Gestion des erreurs 429/402

**2. Aucun autre nouveau fichier**

### Fichiers a modifier

**1. `src/components/intake/shared/I18nInput.tsx`**
- Ajouter un state `isTranslating` (boolean)
- Modifier le `setActiveTab` : quand on clique sur une langue non-francaise, si le champ est vide et le francais est rempli, appeler la fonction `translate` via `supabase.functions.invoke`
- Afficher un spinner/texte "Traduction en cours..." pendant le chargement
- Remplir automatiquement le champ avec le resultat
- Ajouter un petit badge ou indicateur visuel pour montrer que c'est une traduction auto (modifiable)

### Details techniques

- Modele IA : `google/gemini-3-flash-preview` (rapide et economique pour la traduction)
- La traduction n'est declenchee que si :
  - La langue cible est differente du francais
  - Le champ cible est vide
  - Le texte francais n'est pas vide
- Si la traduction echoue, le champ reste vide avec un toast d'erreur
- L'utilisateur peut toujours modifier manuellement apres traduction

### Mapping des langues pour le prompt

| Code | Langue pour le prompt |
|------|----------------------|
| `fr` | Francais |
| `en` | English |
| `ar` | Arabic (Modern Standard) |
| `es` | Spanish |
| `ary` | Moroccan Darija (Arabic dialect) |

