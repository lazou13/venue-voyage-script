import { Loader2 } from 'lucide-react';
import { useAppConfig } from '@/hooks/useAppConfig';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

// Types
interface FieldControl {
  enabled: boolean;
  required: boolean;
}

interface FieldSection {
  id: string;
  title: string;
  enabled: boolean;
  order: number;
}

interface FieldsConfig {
  core?: {
    sections?: FieldSection[];
    controls?: Record<string, FieldControl>;
  };
}

const DEFAULT_CONTROLS: Record<string, { label: string; description: string }> = {
  project_type: { label: 'Type de projet', description: 'Établissement, site touristique, parcours...' },
  target_audience: { label: 'Public cible', description: 'Famille, couples, corporate...' },
  quest_type: { label: 'Type de quête', description: 'Exploration, séquentiel, course...' },
  play_mode: { label: 'Mode de jeu', description: 'Solo, équipes, 1v1...' },
  language: { label: 'Langues', description: 'Langues disponibles pour le contenu' },
  difficulty: { label: 'Difficulté', description: 'Niveau de difficulté de la quête' },
  duration: { label: 'Durée estimée', description: 'Temps estimé pour compléter la quête' },
  storytelling: { label: 'Narration', description: 'Activer la narration avec avatar' },
};

const DEFAULT_SECTIONS: Record<string, { title: string; description: string }> = {
  project: { title: 'Type de projet', description: 'Configuration du type de lieu' },
  quest: { title: 'Configuration de la quête', description: 'Paramètres généraux de la quête' },
  steps: { title: 'Configuration des étapes', description: 'Options par défaut des étapes' },
  rules: { title: 'Règles du jeu', description: 'Scoring, indices, pénalités' },
};

export default function AdminFields() {
  const { draftPayload, isLoading, updateDraft } = useAppConfig();

  const fieldsConfig: FieldsConfig = (draftPayload as any)?.fields || {};
  const controls = fieldsConfig.core?.controls || {};
  const sections = fieldsConfig.core?.sections || [];

  const handleToggleControl = (controlId: string, field: 'enabled' | 'required', value: boolean) => {
    updateDraft((prev) => {
      const currentFields: FieldsConfig = (prev as any).fields || {};
      const currentControls = currentFields.core?.controls || {};
      
      return {
        ...prev,
        fields: {
          ...currentFields,
          core: {
            ...currentFields.core,
            controls: {
              ...currentControls,
              [controlId]: {
                enabled: currentControls[controlId]?.enabled ?? true,
                required: currentControls[controlId]?.required ?? false,
                [field]: value,
              },
            },
          },
        },
      } as any;
    });
  };

  const handleToggleSection = (sectionId: string, enabled: boolean) => {
    updateDraft((prev) => {
      const currentFields: FieldsConfig = (prev as any).fields || {};
      const currentSections = currentFields.core?.sections || [];
      
      const sectionExists = currentSections.some(s => s.id === sectionId);
      let newSections: FieldSection[];
      
      if (sectionExists) {
        newSections = currentSections.map(s => 
          s.id === sectionId ? { ...s, enabled } : s
        );
      } else {
        newSections = [...currentSections, {
          id: sectionId,
          title: DEFAULT_SECTIONS[sectionId]?.title || sectionId,
          enabled,
          order: (currentSections.length + 1) * 10,
        }];
      }
      
      return {
        ...prev,
        fields: {
          ...currentFields,
          core: {
            ...currentFields.core,
            sections: newSections,
          },
        },
      } as any;
    });
  };

  const getSectionEnabled = (sectionId: string): boolean => {
    const section = sections.find(s => s.id === sectionId);
    return section?.enabled ?? true;
  };

  const getControlState = (controlId: string): FieldControl => {
    return controls[controlId] || { enabled: true, required: false };
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold">Configuration des champs</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Activez/désactivez les champs et sections du formulaire d'intake.
        </p>
      </div>

      {/* Sections */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sections du formulaire</CardTitle>
          <CardDescription>
            Gérez la visibilité des sections principales.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(DEFAULT_SECTIONS).map(([sectionId, { title, description }]) => (
            <div key={sectionId} className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">{title}</Label>
                <p className="text-xs text-muted-foreground">{description}</p>
              </div>
              <Switch
                checked={getSectionEnabled(sectionId)}
                onCheckedChange={(checked) => handleToggleSection(sectionId, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator />

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Champs du formulaire</CardTitle>
          <CardDescription>
            Configurez la visibilité et les contraintes de chaque champ.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(DEFAULT_CONTROLS).map(([controlId, { label, description }]) => {
            const state = getControlState(controlId);
            return (
              <div key={controlId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-medium">{label}</Label>
                    <Badge variant="outline" className="text-xs font-mono">
                      {controlId}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{description}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Visible</Label>
                    <Switch
                      checked={state.enabled}
                      onCheckedChange={(checked) => handleToggleControl(controlId, 'enabled', checked)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Requis</Label>
                    <Switch
                      checked={state.required}
                      onCheckedChange={(checked) => handleToggleControl(controlId, 'required', checked)}
                      disabled={!state.enabled}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
