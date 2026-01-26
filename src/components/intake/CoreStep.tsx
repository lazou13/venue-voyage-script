import { useState, useEffect, useRef } from 'react';
import { Gamepad2, Globe, Users, Target, Clock, Gauge, Building2, MapPin, Route } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OptionMatrix, OptionRow } from './shared/OptionMatrix';
import { EnumSelect } from './shared/EnumSelect';
import { EnumCheckboxGroup } from './shared/EnumCheckboxGroup';
import { I18nInput } from './shared/I18nInput';
import { StorytellingSection } from './shared/StorytellingSection';
import type { 
  QuestType, 
  TargetAudience, 
  CompetitionMode,
  SupportedLanguage,
  QuestConfig,
  I18nText,
  ProjectType,
  CoreDetails,
  PlayMode,
  TeamConfig,
  MultiSoloConfig
} from '@/types/intake';
import { 
  QUEST_TYPE_LABELS, 
  TARGET_AUDIENCE_LABELS, 
  COMPETITION_MODE_LABELS,
  LANGUAGE_LABELS,
  PROJECT_TYPE_LABELS,
  PLAY_MODE_LABELS
} from '@/types/intake';

interface CoreStepProps {
  projectId: string;
}

export function CoreStep({ projectId }: CoreStepProps) {
  const { project, updateProject } = useProject(projectId);
  const { toast } = useToast();
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const questConfig = project?.quest_config || {};
  const projectType = questConfig.project_type || 'establishment';
  const coreDetails = questConfig.core || {};
  const languages = coreDetails.languages || questConfig.languages || ['fr'];
  const playMode = questConfig.play_mode;
  const teamConfig = questConfig.teamConfig || {};
  const multiSoloConfig = questConfig.multiSoloConfig || {};
  
  // Local state for debounced text fields
  const [localObjectives, setLocalObjectives] = useState<string>('');
  const [localConstraints, setLocalConstraints] = useState<string>('');
  
  // Sync local state when server data changes
  useEffect(() => {
    setLocalObjectives((coreDetails.objective_business || []).join('\n'));
  }, [coreDetails.objective_business?.join(',')]);
  
  useEffect(() => {
    setLocalConstraints((coreDetails.constraints_general || []).join('\n'));
  }, [coreDetails.constraints_general?.join(',')]);
  
  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const updateQuestConfig = (updates: Partial<QuestConfig>) => {
    updateProject.mutate(
      { quest_config: { ...questConfig, ...updates } },
      { onSuccess: () => toast({ title: 'Sauvegardé' }) }
    );
  };

  const updateCoreDetails = (updates: Partial<CoreDetails>) => {
    updateQuestConfig({ 
      core: { ...coreDetails, ...updates },
      // Also sync languages to top level for backward compat
      languages: updates.languages || coreDetails.languages || ['fr']
    });
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

  // Debounced array field change (for objectives and constraints)
  const handleDebouncedArrayChange = (field: keyof CoreDetails, value: string, setLocal: (v: string) => void) => {
    setLocal(value);
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      const items = value.split('\n').map(s => s.trim()).filter(Boolean);
      updateCoreDetails({ [field]: items });
    }, 500);
  };

  return (
    <div className="space-y-6">
      {/* Project Type Selection */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="w-5 h-5 text-primary" />
            Type de projet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {(['establishment', 'tourist_spot', 'route_recon'] as ProjectType[]).map((type) => {
              const Icon = type === 'establishment' ? Building2 : type === 'tourist_spot' ? MapPin : Route;
              const isSelected = projectType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => updateQuestConfig({ project_type: type })}
                  className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                    isSelected 
                      ? 'border-primary bg-primary/10 text-primary' 
                      : 'border-border hover:border-primary/50 hover:bg-muted'
                  }`}
                >
                  <Icon className={`w-8 h-8 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className="font-medium text-sm">{PROJECT_TYPE_LABELS[type]}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quest Type & Audience */}
      <OptionMatrix 
        title="Configuration de la quête" 
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

        <EnumCheckboxGroup<TargetAudience>
          label="Public cible"
          values={coreDetails.target_audience || (questConfig.targetAudience ? [questConfig.targetAudience] : [])}
          onChange={(v) => {
            updateCoreDetails({ target_audience: v as TargetAudience[] });
            // Also update legacy field
            if (v.length > 0) {
              updateQuestConfig({ targetAudience: v[0] as TargetAudience });
            }
          }}
          options={TARGET_AUDIENCE_LABELS}
        />
      </OptionMatrix>

      {/* Duration & Difficulty */}
      <OptionMatrix 
        title="Paramètres généraux" 
        icon={Clock}
        description="Durée estimée et niveau de difficulté"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Durée estimée (min)</Label>
            <Input
              type="number"
              min={15}
              max={300}
              value={coreDetails.duration_min || ''}
              onChange={(e) => updateCoreDetails({ duration_min: parseInt(e.target.value) || undefined })}
              placeholder="Ex: 60"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Difficulté (1-5)</Label>
            <Input
              type="number"
              min={1}
              max={5}
              value={coreDetails.difficulty || ''}
              onChange={(e) => updateCoreDetails({ difficulty: parseInt(e.target.value) || undefined })}
              placeholder="Ex: 3"
            />
          </div>
        </div>
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
            const newLangs = v.includes('fr') ? v : ['fr', ...v];
            updateCoreDetails({ languages: newLangs as SupportedLanguage[] });
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

      {/* Business Objectives */}
      <OptionMatrix 
        title="Objectifs business" 
        icon={Target}
        description="Définissez les objectifs métier (un par ligne)"
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Objectifs</Label>
          <Textarea
            value={localObjectives}
            onChange={(e) => handleDebouncedArrayChange('objective_business', e.target.value, setLocalObjectives)}
            placeholder="Ex: Fidélisation client&#10;Animation événementielle&#10;Promotion locale"
            rows={3}
          />
        </div>
      </OptionMatrix>

      {/* General Constraints */}
      <OptionMatrix 
        title="Contraintes générales" 
        icon={Gauge}
        description="Contraintes globales (un par ligne)"
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Contraintes</Label>
          <Textarea
            value={localConstraints}
            onChange={(e) => handleDebouncedArrayChange('constraints_general', e.target.value, setLocalConstraints)}
            placeholder="Ex: Accessible PMR&#10;Sans bruit après 22h&#10;Budget limité"
            rows={3}
          />
        </div>
      </OptionMatrix>

      {/* Play Mode Selection */}
      <OptionMatrix 
        title="Mode de jeu" 
        icon={Users}
        description="Choisissez comment les joueurs participent"
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {(['solo', 'team', 'one_vs_one', 'multi_solo'] as PlayMode[]).map((mode) => {
            const isSelected = playMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => updateQuestConfig({ play_mode: mode })}
                className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  isSelected 
                    ? 'border-primary bg-primary/10 text-primary' 
                    : 'border-border hover:border-primary/50 hover:bg-muted'
                }`}
              >
                <span className="font-medium text-sm">{PLAY_MODE_LABELS[mode]}</span>
              </button>
            );
          })}
        </div>
        
        {!playMode && (
          <p className="text-xs text-destructive">Mode de jeu requis</p>
        )}

        {/* Team mode fields */}
        {playMode === 'team' && (
          <div className="space-y-4 p-3 border rounded-lg bg-muted/30">
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
                <Label className="text-sm">Temps limite (minutes)</Label>
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
          </div>
        )}

        {/* One vs One - fixed 2 players info */}
        {playMode === 'one_vs_one' && (
          <div className="p-3 border rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Mode duel : 2 joueurs s'affrontent en temps réel.
            </p>
          </div>
        )}

        {/* Multi Solo fields */}
        {playMode === 'multi_solo' && (
          <div className="space-y-4 p-3 border rounded-lg bg-muted/30">
            <div className="space-y-1.5">
              <Label className="text-sm">Nombre max de joueurs</Label>
              <Input
                type="number"
                min={2}
                max={100}
                value={multiSoloConfig.maxPlayers || ''}
                onChange={(e) => updateQuestConfig({ 
                  multiSoloConfig: { ...multiSoloConfig, maxPlayers: parseInt(e.target.value) || undefined } 
                })}
                placeholder="Ex: 20"
              />
            </div>
            <OptionRow label="Classement activé" description="Afficher un leaderboard des scores">
              <Switch
                checked={multiSoloConfig.leaderboardEnabled ?? true}
                onCheckedChange={(v) => updateQuestConfig({ 
                  multiSoloConfig: { ...multiSoloConfig, leaderboardEnabled: v } 
                })}
              />
            </OptionRow>
          </div>
        )}
      </OptionMatrix>

      {/* Storytelling Section */}
      <StorytellingSection projectId={projectId} />
    </div>
  );
}
