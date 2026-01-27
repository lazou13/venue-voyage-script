import { Loader2 } from 'lucide-react';
import { useAppConfig } from '@/hooks/useAppConfig';
import { EnumEditor } from '@/components/admin/EnumEditor';
import type { EnumItem, CapabilitiesPayload } from '@/hooks/useCapabilities';

// Define which enums to show and their metadata
const ENUM_DEFINITIONS: {
  key: keyof CapabilitiesPayload['enums'];
  title: string;
  description: string;
  color: string;
}[] = [
  { 
    key: 'project_types', 
    title: 'Types de projet', 
    description: 'establishment, tourist_spot, route_recon...',
    color: 'hsl(262, 83%, 58%)' // Purple
  },
  { 
    key: 'target_audiences', 
    title: 'Publics cibles', 
    description: 'family, couples, corporate...',
    color: 'hsl(330, 81%, 60%)' // Pink
  },
  { 
    key: 'play_modes', 
    title: 'Modes de jeu', 
    description: 'solo, team, one_vs_one...',
    color: 'hsl(200, 98%, 39%)' // Blue
  },
  { 
    key: 'step_types', 
    title: 'Types d\'étape', 
    description: 'story, mcq, enigme, photo...',
    color: 'hsl(142, 71%, 45%)' // Green
  },
  { 
    key: 'validation_modes', 
    title: 'Modes de validation', 
    description: 'qr_code, photo, code, manual...',
    color: 'hsl(38, 92%, 50%)' // Orange
  },
  { 
    key: 'quest_types', 
    title: 'Types de quête', 
    description: 'exploration, sequential, timed_race...',
    color: 'hsl(280, 87%, 53%)' // Violet
  },
  { 
    key: 'languages', 
    title: 'Langues', 
    description: 'fr, en, ar, es...',
    color: 'hsl(172, 66%, 50%)' // Teal
  },
  { 
    key: 'difficulty_levels', 
    title: 'Niveaux de difficulté', 
    description: 'easy, medium, hard',
    color: 'hsl(0, 72%, 51%)' // Red
  },
  { 
    key: 'competition_modes', 
    title: 'Modes de compétition', 
    description: 'race, score, timed',
    color: 'hsl(45, 93%, 47%)' // Yellow
  },
];

export default function AdminEnums() {
  const { draftPayload, isLoading, updateDraft } = useAppConfig();

  const handleEnumChange = (enumKey: keyof CapabilitiesPayload['enums'], items: EnumItem[]) => {
    updateDraft((prev) => ({
      ...prev,
      enums: {
        ...prev.enums,
        [enumKey]: items,
      },
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!draftPayload) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Aucune configuration trouvée.</p>
        <p className="text-sm text-muted-foreground mt-1">
          Créez une configuration depuis la base de données.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold">Gestion des Enums</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Modifiez les listes de valeurs disponibles dans l'application. Les IDs doivent être en snake_case.
        </p>
      </div>

      <div className="grid gap-4">
        {ENUM_DEFINITIONS.map(({ key, title, description, color }) => {
          const items = draftPayload.enums[key] || [];
          return (
            <EnumEditor
              key={key}
              title={title}
              description={description}
              items={items}
              onChange={(newItems) => handleEnumChange(key, newItems)}
              accentColor={color}
            />
          );
        })}
      </div>
    </div>
  );
}
