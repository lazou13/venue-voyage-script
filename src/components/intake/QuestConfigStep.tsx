import { Gamepad2, Users, Globe } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OptionMatrix, OptionRow } from './shared/OptionMatrix';
import { EnumSelect } from './shared/EnumSelect';
import { EnumCheckboxGroup } from './shared/EnumCheckboxGroup';
import { I18nInput } from './shared/I18nInput';
import type { 
  QuestType, 
  TargetAudience, 
  CompetitionMode,
  SupportedLanguage,
  QuestConfig,
  I18nText 
} from '@/types/intake';
import { 
  QUEST_TYPE_LABELS, 
  TARGET_AUDIENCE_LABELS, 
  COMPETITION_MODE_LABELS,
  LANGUAGE_LABELS 
} from '@/types/intake';

interface QuestConfigStepProps {
  projectId: string;
}

export function QuestConfigStep({ projectId }: QuestConfigStepProps) {
  const { project, updateProject } = useProject(projectId);
  const { toast } = useToast();

  const questConfig = project?.quest_config || {};
  const languages = questConfig.languages || ['fr'];
  const teamConfig = questConfig.teamConfig || { enabled: false };

  const updateQuestConfig = (updates: Partial<QuestConfig>) => {
    updateProject.mutate(
      { quest_config: { ...questConfig, ...updates } },
      { onSuccess: () => toast({ title: 'Sauvegardé' }) }
    );
  };

  const updateTitleI18n = (value: I18nText) => {
    updateProject.mutate(
      { title_i18n: value },
      { onSuccess: () => toast({ title: 'Sauvegardé' }) }
    );
  };

  const updateStoryI18n = (value: I18nText) => {
    updateProject.mutate(
      { story_i18n: value },
      { onSuccess: () => toast({ title: 'Sauvegardé' }) }
    );
  };

  return (
    <div className="space-y-6">
      {/* Quest Type & Audience */}
      <OptionMatrix 
        title="Configuration Quest" 
        icon={Gamepad2}
        description="Définissez le type de quête et le public cible"
      >
        <EnumSelect<QuestType>
          label="Type de quête"
          value={questConfig.questType}
          onChange={(v) => updateQuestConfig({ questType: v })}
          options={QUEST_TYPE_LABELS}
          placeholder="Sélectionner le type..."
        />

        <EnumSelect<TargetAudience>
          label="Public cible"
          value={questConfig.targetAudience}
          onChange={(v) => updateQuestConfig({ targetAudience: v })}
          options={TARGET_AUDIENCE_LABELS}
          placeholder="Sélectionner le public..."
        />
      </OptionMatrix>

      {/* Languages */}
      <OptionMatrix 
        title="Langues" 
        icon={Globe}
        description="FR est obligatoire. Sélectionnez les langues additionnelles."
      >
        <EnumCheckboxGroup<SupportedLanguage>
          label="Langues activées"
          values={languages}
          onChange={(v) => {
            // Ensure FR is always included
            const newLangs = v.includes('fr') ? v : ['fr', ...v];
            updateQuestConfig({ languages: newLangs as SupportedLanguage[] });
          }}
          options={LANGUAGE_LABELS}
          requiredValues={['fr']}
        />
      </OptionMatrix>

      {/* I18n Content */}
      <OptionMatrix 
        title="Contenu Multilingue"
        description="Titre et histoire dans les langues sélectionnées"
      >
        <I18nInput
          label="Titre de la quête"
          value={project?.title_i18n || {}}
          onChange={updateTitleI18n}
          languages={languages}
          frRequired
          placeholder="Ex: La Quête du Trésor Caché"
        />

        <I18nInput
          label="Histoire / Synopsis"
          value={project?.story_i18n || {}}
          onChange={updateStoryI18n}
          languages={languages}
          multiline
          rows={4}
          frRequired
          placeholder="Décrivez l'intrigue et le contexte narratif..."
        />
      </OptionMatrix>

      {/* Team Configuration */}
      <OptionMatrix 
        title="Configuration Équipes" 
        icon={Users}
        description="Activez le mode équipe pour les compétitions"
      >
        <OptionRow label="Mode équipe activé" description="Permet de jouer en équipes">
          <Switch
            checked={teamConfig.enabled}
            onCheckedChange={(v) => updateQuestConfig({ 
              teamConfig: { ...teamConfig, enabled: v } 
            })}
          />
        </OptionRow>

        {teamConfig.enabled && (
          <>
            <EnumSelect<CompetitionMode>
              label="Mode de compétition"
              value={teamConfig.competitionMode}
              onChange={(v) => updateQuestConfig({ 
                teamConfig: { ...teamConfig, competitionMode: v } 
              })}
              options={COMPETITION_MODE_LABELS}
              placeholder="Sélectionner le mode..."
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Nombre max d'équipes <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={2}
                  max={20}
                  value={teamConfig.maxTeams || ''}
                  onChange={(e) => updateQuestConfig({ 
                    teamConfig: { ...teamConfig, maxTeams: parseInt(e.target.value) || undefined } 
                  })}
                  placeholder="Ex: 4"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm">
                  Joueurs max par équipe <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={teamConfig.maxPlayersPerTeam || ''}
                  onChange={(e) => updateQuestConfig({ 
                    teamConfig: { ...teamConfig, maxPlayersPerTeam: parseInt(e.target.value) || undefined } 
                  })}
                  placeholder="Ex: 5"
                />
              </div>
            </div>

            {teamConfig.competitionMode === 'timed' && (
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Temps limite (minutes) <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={5}
                  max={300}
                  value={teamConfig.timeLimitMinutes || ''}
                  onChange={(e) => updateQuestConfig({ 
                    teamConfig: { ...teamConfig, timeLimitMinutes: parseInt(e.target.value) || undefined } 
                  })}
                  placeholder="Ex: 60"
                />
              </div>
            )}
          </>
        )}
      </OptionMatrix>
    </div>
  );
}
