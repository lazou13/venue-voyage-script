
# Plan: Finaliser le module Storytelling et Avatars (Option 2)

## Resume

Ce plan renforce la robustesse du module storytelling avec:
- UX amelioree (onglets, recherche, confirmation)
- Empty state avec seeding de placeholders
- Validation affinee (blocker vs warnings)
- Export securise avec fallback

---

## 1. UX Hardening (StorytellingSection.tsx)

### 1.1 Structure en onglets

Ajouter deux onglets pour separer les avatars:
- **Bibliotheque**: avatars globaux (project_id = null)
- **Ce projet**: avatars specifiques au projet courant

Utiliser le composant `Tabs` existant de `@/components/ui/tabs`.

### 1.2 Badge Narrateur + Selection amelioree

- Ajouter un badge "Narrateur" visible sur l'avatar selectionne
- Bouton "Definir comme narrateur" apparait au hover sur les autres avatars
- Confirmation dialog avant changement de narrateur (previent clics accidentels)

### 1.3 Recherche et filtres

- Input de recherche par nom
- Chips de filtrage rapide: style, persona, age
- Filtrage cote client (pas de requete DB)

### 1.4 Upload toujours visible

Deplacer le bouton "+ Ajouter un avatar" hors du bloc conditionnel `storytelling.enabled` pour qu'il soit toujours accessible.

---

## 2. Empty State et Seeding

### 2.1 Detection empty state

Si `avatars.length === 0`, afficher un ecran vide avec CTA:
```
Aucun avatar disponible.
[Importer le pack de 10 avatars placeholders]
```

### 2.2 Fonction de seeding client-side

Creer une fonction `seedPlaceholderAvatars` dans `useAvatars.ts`:
- Insere 10 avatars avec des noms varies (Luna, Max, Sofia, etc.)
- Utilise des images placeholder (ex: `https://ui-avatars.com/api/?name=Luna&size=200`)
- Styles/personas/ages varies pour la diversite
- Tous globaux (project_id = null)

---

## 3. Validation Logic (useProject.ts)

### 3.1 Blocker storytelling

Conserver le blocker existant (deja correct):
```typescript
if (storytelling?.enabled === true && !storytelling.narrator?.avatar_id) {
  errors.push('Avatar narrateur requis');
}
```

### 3.2 Warning avatar count

Ajouter un warning (non bloquant):
```typescript
// Ne necessite pas avatarsQuery dans useProject
// Ce warning sera ajoute via parametre externe
warnings.push('Moins de 10 avatars disponibles (recommande: 10+)');
```

Note: Puisque `useProject` ne fetch pas les avatars, ce warning sera gere dans `OutputsStep.tsx` qui a acces aux avatars.

### 3.3 Default storytelling.enabled = false

Deja le cas par defaut (pas de changement necessaire).

---

## 4. Export Robustness (outputGenerators.ts)

### 4.1 Omission si disabled

Si `storytelling.enabled === false`, le bloc narrator est deja `null`. Renforcer en omettant completement:

```typescript
// Si disabled, ne pas inclure storytelling du tout dans l'export
if (!storytelling?.enabled) {
  // Omettre ou mettre { enabled: false }
}
```

### 4.2 Fallback si avatar supprime

Si `storytelling.enabled === true` mais l'avatar n'est pas trouve:
```typescript
if (storytelling?.enabled && storytelling.narrator?.avatar_id) {
  const avatar = avatars.find(a => a.id === storytelling.narrator?.avatar_id);
  if (avatar) {
    // ... normal export
  } else {
    // Fallback avec warning explicite
    storytellingData.narrator = null;
    storytellingData._warning = 'narrator_avatar_deleted';
  }
}
```

### 4.3 Structure export narrator

Structure finale garantie:
```json
{
  "storytelling": {
    "enabled": true,
    "narrator": {
      "avatar_id": "uuid",
      "avatar_image_url": "https://...",
      "avatar_tags": {
        "name": "Luna",
        "style": "cartoon",
        "persona": "guide_host",
        "age": "adult",
        "outfit": "modern"
      }
    }
  }
}
```

---

## 5. OutputsStep Wiring

### 5.1 Garantir avatars non undefined

Deja fait avec `avatars ?? []` dans le hook, mais renforcer:
```typescript
const data = { 
  project, 
  pois, 
  wifiZones, 
  forbiddenZones, 
  avatars: avatars || [] 
};
```

### 5.2 Warning avatar count dans OutputsStep

Ajouter dans OutputsStep si `avatars.length < 10`:
```typescript
if (avatars.length < 10 && !validation.warnings.includes('...')) {
  validation.warnings.push('Moins de 10 avatars disponibles (recommande: 10+)');
}
```

---

## 6. Fichiers a modifier

| Fichier | Changement |
|---------|------------|
| `src/components/intake/shared/StorytellingSection.tsx` | Onglets, search, filtres, confirm dialog, empty state, seed CTA |
| `src/hooks/useAvatars.ts` | Ajouter `seedPlaceholderAvatars` mutation |
| `src/lib/outputGenerators.ts` | Fallback si avatar supprime, omission propre si disabled |
| `src/components/intake/OutputsStep.tsx` | Warning avatar count < 10 |
| `src/hooks/useProject.ts` | Aucun changement (blocker deja correct) |

---

## Section Technique

### Architecture des filtres

```text
[Search Input] + [Style chips] + [Persona chips] + [Age chips]
         |
         v
   useMemo filter sur avatars[]
         |
         v
   Affichage grid filtree
```

### Seeding data

```typescript
const PLACEHOLDER_AVATARS = [
  { name: 'Luna', style: 'cartoon', persona: 'guide_host', age: 'adult', outfit: 'modern' },
  { name: 'Max', style: 'realistic', persona: 'detective', age: 'adult', outfit: 'adventure' },
  { name: 'Sofia', style: 'anime', persona: 'explorer', age: 'teen', outfit: 'modern' },
  { name: 'Karim', style: 'semi_realistic', persona: 'historian', age: 'senior', outfit: 'traditional' },
  { name: 'Yuki', style: 'minimal', persona: 'ai_assistant', age: 'adult', outfit: 'modern' },
  { name: 'Theo', style: 'cartoon', persona: 'mascot', age: 'child', outfit: 'adventure' },
  { name: 'Nadia', style: 'realistic', persona: 'local_character', age: 'adult', outfit: 'traditional' },
  { name: 'Jade', style: 'anime', persona: 'villain_light', age: 'teen', outfit: 'luxury' },
  { name: 'Omar', style: 'cartoon', persona: 'guide_host', age: 'adult', outfit: 'adventure' },
  { name: 'Emma', style: 'semi_realistic', persona: 'explorer', age: 'adult', outfit: 'modern' },
];
```

### Confirm Dialog Flow

```text
[Click avatar different]
        |
        v
   narrator deja selectionne?
        |
     Non --> selection directe
        |
     Oui --> AlertDialog "Changer de narrateur?"
                |
             Cancel --> rien
                |
             Confirm --> updateStorytelling(new avatar_id)
```

---

## QA Checklist

1. **Nouveau projet, storytelling off**
   - Aller sur Exports
   - Verifier: pas d'erreur "Avatar narrateur requis"
   - Exports fonctionnent

2. **Activer storytelling sans narrateur**
   - Toggle storytelling ON
   - Ne pas selectionner d'avatar
   - Aller sur Exports
   - Verifier: erreur "Avatar narrateur requis"

3. **Upload avatar + selection**
   - Cliquer "+ Ajouter un avatar"
   - Uploader image, remplir champs
   - Sauvegarder
   - Cliquer sur l'avatar pour le selectionner
   - Aller sur Exports
   - Verifier: pas d'erreur, JSON contient `avatar_image_url`

4. **Supprimer avatar narrateur**
   - Supprimer l'avatar selectionne
   - Verifier: selection cleared
   - Aller sur Exports
   - Verifier: erreur "Avatar narrateur requis"

5. **Empty state + seeding**
   - Si 0 avatars: verifier CTA visible
   - Cliquer "Importer pack"
   - Verifier: 10 avatars apparaissent

6. **Onglets Bibliotheque/Projet**
   - Upload avatar global -> apparait dans "Bibliotheque"
   - Upload avatar projet -> apparait dans "Ce projet"

7. **Confirmation changement narrateur**
   - Selectionner avatar A
   - Cliquer sur avatar B
   - Verifier: dialog de confirmation apparait
   - Annuler -> A reste selectionne
   - Confirmer -> B selectionne
