
# Plan: Avatar Gallery avec Selection Narrateur

## Resume

Implementation d'une galerie d'avatars uploadables avec selection d'un narrateur lorsque le mode "storytelling" est active. Les exports sont bloques si storytelling est active mais aucun avatar n'est selectionne.

## Architecture

### 1. Base de donnees

**Nouvelle table `avatars`:**

```sql
CREATE TABLE public.avatars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  style text NOT NULL CHECK (style IN ('cartoon', 'realistic', 'semi_realistic', 'anime', 'minimal')),
  age text NOT NULL CHECK (age IN ('child', 'teen', 'adult', 'senior')),
  persona text NOT NULL CHECK (persona IN ('guide_host', 'detective', 'explorer', 'historian', 'local_character', 'mascot', 'ai_assistant', 'villain_light')),
  outfit text NOT NULL CHECK (outfit IN ('traditional', 'modern', 'luxury', 'adventure')),
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- RLS: acces public comme les autres tables du projet
ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to avatars" ON public.avatars FOR ALL USING (true) WITH CHECK (true);
```

**Note:** `project_id = NULL` signifie avatar global reutilisable, sinon avatar specifique au projet.

### 2. Types TypeScript

**Fichier: `src/types/intake.ts`**

Ajouts:
```typescript
// ============= Avatar types =============
export type AvatarStyle = 'cartoon' | 'realistic' | 'semi_realistic' | 'anime' | 'minimal';
export type AvatarAge = 'child' | 'teen' | 'adult' | 'senior';
export type AvatarPersona = 'guide_host' | 'detective' | 'explorer' | 'historian' | 'local_character' | 'mascot' | 'ai_assistant' | 'villain_light';
export type AvatarOutfit = 'traditional' | 'modern' | 'luxury' | 'adventure';

export interface Avatar {
  id: string;
  project_id: string | null;
  name: string;
  style: AvatarStyle;
  age: AvatarAge;
  persona: AvatarPersona;
  outfit: AvatarOutfit;
  image_url: string;
  created_at: string;
}

export interface StorytellingConfig {
  enabled: boolean;
  narrator?: {
    avatar_id: string | null;
  };
}

// Labels
export const AVATAR_STYLE_LABELS: Record<AvatarStyle, string> = {
  cartoon: 'Cartoon',
  realistic: 'Realiste',
  semi_realistic: 'Semi-realiste',
  anime: 'Anime',
  minimal: 'Minimal',
};

export const AVATAR_AGE_LABELS: Record<AvatarAge, string> = {
  child: 'Enfant',
  teen: 'Ado',
  adult: 'Adulte',
  senior: 'Senior',
};

export const AVATAR_PERSONA_LABELS: Record<AvatarPersona, string> = {
  guide_host: 'Guide/Hote',
  detective: 'Detective',
  explorer: 'Explorateur',
  historian: 'Historien',
  local_character: 'Personnage local',
  mascot: 'Mascotte',
  ai_assistant: 'Assistant IA',
  villain_light: 'Villain leger',
};

export const AVATAR_OUTFIT_LABELS: Record<AvatarOutfit, string> = {
  traditional: 'Traditionnel',
  modern: 'Moderne',
  luxury: 'Luxe',
  adventure: 'Aventure',
};
```

**Extension de QuestConfig:**
```typescript
export interface QuestConfig {
  // ... champs existants
  storytelling?: StorytellingConfig;
}
```

### 3. Hook useAvatars

**Nouveau fichier: `src/hooks/useAvatars.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Avatar } from '@/types/intake';

export function useAvatars(projectId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch avatars: global (project_id IS NULL) + project-specific
  const avatarsQuery = useQuery({
    queryKey: ['avatars', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('avatars')
        .select('*')
        .or(`project_id.is.null,project_id.eq.${projectId}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Avatar[];
    },
    enabled: !!projectId,
  });

  const addAvatar = useMutation({
    mutationFn: async (avatar: Omit<Avatar, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('avatars')
        .insert(avatar)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatars', projectId] });
    },
  });

  const deleteAvatar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('avatars').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatars', projectId] });
    },
  });

  return {
    avatars: avatarsQuery.data || [],
    isLoading: avatarsQuery.isLoading,
    addAvatar,
    deleteAvatar,
  };
}
```

### 4. Composant UI - StorytellingSection

**Nouveau fichier: `src/components/intake/shared/StorytellingSection.tsx`**

Fonctionnalites:
- Toggle "Storytelling active"
- Grille d'avatars avec selection (outline primary sur avatar selectionne)
- Chaque carte affiche: image, nom, badges (style, persona, age)
- Bouton "+ Ajouter un avatar" ouvre un Dialog
- Dialog avec: upload image, nom, style, persona, age, outfit, scope (global/projet)
- Filtres optionnels par chips (style/persona/age)

Structure du composant:
```text
<Card>
  <CardHeader>Storytelling</CardHeader>
  <CardContent>
    <Switch> Activer le storytelling
    
    {storytelling.enabled && (
      <>
        <Label>Avatar narrateur</Label>
        <div className="grid grid-cols-3 gap-3">
          {avatars.map(avatar => (
            <AvatarCard 
              selected={avatar.id === narrator.avatar_id}
              onClick={() => setNarratorAvatarId(avatar.id)}
            />
          ))}
        </div>
        
        <Button onClick={openAddModal}>+ Ajouter un avatar</Button>
        
        <Dialog>
          <form>
            <FileUpload />
            <Input name />
            <Select style />
            <Select persona />
            <Select age />
            <Select outfit />
            <RadioGroup scope: global | this_project />
            <Button submit>Sauvegarder</Button>
          </form>
        </Dialog>
      </>
    )}
  </CardContent>
</Card>
```

### 5. Integration dans CoreStep.tsx

Ajouter la section Storytelling apres les autres OptionMatrix:

```typescript
import { StorytellingSection } from './shared/StorytellingSection';

// Dans le return, apres Play Mode:
<StorytellingSection projectId={projectId} />
```

### 6. Validation (useProject.ts)

**Ajout dans la fonction `validate()`:**

```typescript
// Storytelling validation
const storytelling = project?.quest_config?.storytelling;
if (storytelling?.enabled === true) {
  if (!storytelling.narrator?.avatar_id) {
    errors.push('Avatar narrateur requis');
  }
}

// Warning for low avatar count
const avatarCount = /* count from avatars table */;
if (avatarCount < 10) {
  warnings.push(`Ajoute au moins 10 avatars pour une meilleure variete (actuellement ${avatarCount})`);
}
```

**Snippet exact du blocker:**
```typescript
// Fichier: src/hooks/useProject.ts, dans validate()
const storytelling = project?.quest_config?.storytelling;
if (storytelling?.enabled === true && !storytelling.narrator?.avatar_id) {
  errors.push('Avatar narrateur requis');
}
```

### 7. Exports (outputGenerators.ts)

**Modification de buildQuestExport:**

```typescript
// Dans la fonction buildQuestExport, ajouter lookup avatar:
const storytelling = questConfig.storytelling;
let narratorData = null;

if (storytelling?.enabled && storytelling.narrator?.avatar_id) {
  // Lookup avatar from data passed in (we'll need to add avatars to OutputData)
  const avatar = avatars.find(a => a.id === storytelling.narrator.avatar_id);
  if (avatar) {
    narratorData = {
      avatar_id: avatar.id,
      avatar_image_url: avatar.image_url,
      avatar_tags: {
        name: avatar.name,
        style: avatar.style,
        persona: avatar.persona,
        age: avatar.age,
        outfit: avatar.outfit,
      },
    };
  }
}

return {
  // ... existing fields
  storytelling: {
    enabled: storytelling?.enabled || false,
    narrator: narratorData,
  },
  // ...
};
```

**Snippet exact de l'export avec image_url lookup:**
```typescript
// Fichier: src/lib/outputGenerators.ts
const avatar = avatars.find(a => a.id === storytelling.narrator?.avatar_id);
const narratorData = avatar ? {
  avatar_id: avatar.id,
  avatar_image_url: avatar.image_url,
  avatar_tags: {
    name: avatar.name,
    style: avatar.style,
    persona: avatar.persona,
    age: avatar.age,
    outfit: avatar.outfit,
  },
} : null;
```

**STEP_TABLE modification:**

Ajouter une ligne de resume en haut du tableau:
```
| Narrateur | {avatar.name} ({avatar.persona}, {avatar.style}) |
```

### 8. Fichiers a modifier/creer

| Fichier | Action |
|---------|--------|
| Migration SQL | Creer table `avatars` |
| `src/types/intake.ts` | Ajouter types Avatar, StorytellingConfig, labels |
| `src/hooks/useAvatars.ts` | Nouveau - hook CRUD avatars |
| `src/components/intake/shared/StorytellingSection.tsx` | Nouveau - UI galerie + modal |
| `src/components/intake/CoreStep.tsx` | Importer et afficher StorytellingSection |
| `src/hooks/useProject.ts` | Ajouter validation storytelling |
| `src/lib/outputGenerators.ts` | Modifier OutputData, buildQuestExport, STEP_TABLE |
| `src/components/intake/OutputsStep.tsx` | Passer avatars a generatePrompt/buildQuestExport |

## Section Technique

### Flow de donnees

```text
[Avatar Upload]
     |
     v
useFileUpload.uploadFile('avatars/...') 
     |
     v
[public URL returned]
     |
     v
useAvatars.addAvatar({ image_url, name, style, ... })
     |
     v
[Row in avatars table]
```

### Selection narrateur

```text
[Click on avatar card]
     |
     v
updateQuestConfig({ 
  storytelling: { 
    enabled: true, 
    narrator: { avatar_id: selectedId } 
  }
})
     |
     v
[Saved in projects.quest_config JSONB]
```

### Validation flow

```text
[validate() called]
     |
     v
if (storytelling.enabled && !narrator.avatar_id)
  => errors.push('Avatar narrateur requis')
     |
     v
[OutputsStep shows error, blocks generation]
```

## QA (60 secondes)

1. **Upload 2 avatars:**
   - Cliquer "+ Ajouter un avatar"
   - Uploader une image, remplir nom/style/persona/age/outfit
   - Sauvegarder
   - Verifier que l'avatar apparait dans la grille
   - Repeter pour 2eme avatar

2. **Storytelling sans avatar:**
   - Activer toggle "Storytelling"
   - Ne pas selectionner d'avatar
   - Aller sur onglet Exports
   - Verifier erreur "Avatar narrateur requis"

3. **Selection avatar:**
   - Cliquer sur un avatar dans la grille
   - Verifier outline/selection visible
   - Aller sur Exports
   - Verifier pas d'erreur storytelling
   - Copier QUEST_EXPORT_JSON
   - Verifier presence de `storytelling.narrator.avatar_image_url`
