import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Settings2, Copy } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { usePOIs, DEFAULT_STEP_CONFIG, DEFAULT_SCORING } from '@/hooks/usePOIs';
import { useToast } from '@/hooks/use-toast';
import { useCapabilities } from '@/hooks/useCapabilities';
import { getStepTypeLabels, getValidationModeLabels, getPhotoValidationTypeLabels } from '@/lib/capabilitiesHelpers';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { EnumCheckboxGroup } from './shared/EnumCheckboxGroup';
import { EnumSelect } from './shared/EnumSelect';
import { I18nInput } from './shared/I18nInput';
import { PresetSelector } from './PresetSelector';
import { SelectiveApplyPanel } from './SelectiveApplyPanel';
import { PhotoReferenceBlock } from './shared/PhotoReferenceBlock';
import { stepConfigHasMissingDefaults } from '@/lib/normalizeStepConfig';
import type { 
  POI, 
  StepType, 
  ValidationMode, 
  PhotoValidationType,
  StepConfig,
  SupportedLanguage,
  QuestConfig
} from '@/types/intake';
import { 
  STEP_TYPE_LABELS, 
  VALIDATION_MODE_LABELS, 
  PHOTO_VALIDATION_LABELS 
} from '@/types/intake';

interface StepsBuilderStepProps {
  projectId: string;
}

// Helper to auto-reset photo reference fields when photo mode is removed
function getPhotoReferenceResetIfNeeded(
  config: StepConfig, 
  updates: Partial<StepConfig>
): Partial<StepConfig> {
  // Check if we're updating possible_validation_modes
  if (updates.possible_validation_modes) {
    const hadPhoto = config.possible_validation_modes?.includes('photo') || config.validationMode === 'photo';
    const hasPhoto = updates.possible_validation_modes.includes('photo');
    
    // If photo mode was removed, reset photo reference fields
    if (hadPhoto && !hasPhoto) {
      return {
        ...updates,
        photo_reference_required: false,
        reference_image_url: null,
        reference_image_caption: null,
      };
    }
  }
  return updates;
}

// Store current step defaults (can be updated by presets)
let currentStepDefaults: Partial<StepConfig> = { ...DEFAULT_STEP_CONFIG };

export function StepsBuilderStep({ projectId }: StepsBuilderStepProps) {
  const { pois, project, updateProject } = useProject(projectId);
  const { updatePOI, duplicatePOI, applySelectiveDefaults } = usePOIs(projectId);
  const { toast } = useToast();
  const { capabilities } = useCapabilities();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Dynamic labels from capabilities (with fallback to hardcoded)
  const stepTypeLabels = useMemo(() => getStepTypeLabels(capabilities) || STEP_TYPE_LABELS, [capabilities]);
  const validationModeLabels = useMemo(() => getValidationModeLabels(capabilities) || VALIDATION_MODE_LABELS, [capabilities]);
  const photoValidationLabels = useMemo(() => getPhotoValidationTypeLabels(capabilities) || PHOTO_VALIDATION_LABELS, [capabilities]);

  const languages = (project?.quest_config?.languages || ['fr']) as SupportedLanguage[];

  const updateStepConfig = (poiId: string, currentConfig: StepConfig, updates: Partial<StepConfig>) => {
    // Auto-reset photo reference fields if photo mode is removed
    const finalUpdates = getPhotoReferenceResetIfNeeded(currentConfig, updates);
    const newConfig = { ...currentConfig, ...finalUpdates };
    updatePOI.mutate(
      { id: poiId, step_config: newConfig },
      { onSuccess: () => toast({ title: 'Sauvegardé' }) }
    );
  };

  const handleDuplicate = (poi: POI) => {
    duplicatePOI.mutate(poi, {
      onSuccess: () => toast({ title: 'Étape dupliquée', description: `${poi.name} (copie) créée` }),
      onError: (err) => toast({ title: 'Erreur', description: String(err), variant: 'destructive' }),
    });
  };

  const handleApplyPreset = (
    questConfig: Partial<QuestConfig>,
    stepDefaults: Partial<StepConfig>,
    applyToExisting: boolean
  ) => {
    // Update quest config
    updateProject.mutate(
      { quest_config: { ...project?.quest_config, ...questConfig } },
      {
        onSuccess: () => {
          toast({ title: 'Preset appliqué', description: 'Configuration globale mise à jour' });
        },
      }
    );

    // Store the step defaults for new steps
    currentStepDefaults = { ...DEFAULT_STEP_CONFIG, ...stepDefaults };

    // Apply to existing steps if requested
    if (applyToExisting && pois.length > 0) {
      applySelectiveDefaults.mutate(
        {
          defaults: stepDefaults,
          fields: { stepType: true, validationMode: true, scoring: true, hints: true },
        },
        {
          onSuccess: (count) => {
            if (count && count > 0) {
              toast({ 
                title: 'Étapes mises à jour', 
                description: `${count} étape(s) avec valeurs manquantes mises à jour` 
              });
            }
          },
        }
      );
    }
  };

  const handleSelectiveApply = (fields: {
    stepType?: boolean;
    validationMode?: boolean;
    scoring?: boolean;
    hints?: boolean;
  }) => {
    applySelectiveDefaults.mutate(
      { defaults: currentStepDefaults, fields },
      {
        onSuccess: (count) => {
          toast({ 
            title: 'Défauts appliqués', 
            description: `${count || 0} étape(s) mises à jour` 
          });
        },
        onError: (err) => toast({ title: 'Erreur', description: String(err), variant: 'destructive' }),
      }
    );
  };

  const stepsWithMissingDefaults = pois.filter(p => stepConfigHasMissingDefaults(p.step_config)).length;

  if (pois.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="border-dashed">
          <CardContent className="py-6">
            <p className="text-sm font-medium mb-2">Presets rapides</p>
            <p className="text-xs text-muted-foreground mb-3">
              Choisissez un preset pour configurer la quête automatiquement
            </p>
            <PresetSelector
              onApplyPreset={handleApplyPreset}
              hasExistingSteps={false}
            />
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Settings2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Aucune étape définie</p>
            <p className="text-sm mt-1">Ajoutez des étapes dans l'onglet Terrain</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h3 className="font-semibold">Configuration des Étapes</h3>
          <p className="text-sm text-muted-foreground">
            Définissez les possibilités et le contenu de chaque étape
          </p>
        </div>
        <Badge variant="outline">{pois.length} étapes</Badge>
      </div>

      {/* Preset and Apply Actions */}
      <Card className="border-dashed">
        <CardContent className="py-4 space-y-3">
          <div>
            <p className="text-sm font-medium mb-2">Presets rapides</p>
            <PresetSelector
              onApplyPreset={handleApplyPreset}
              hasExistingSteps={pois.length > 0}
            />
          </div>

          <div className="border-t pt-3">
            <SelectiveApplyPanel
              onApply={handleSelectiveApply}
              disabled={applySelectiveDefaults.isPending}
              stepsNeedingDefaults={stepsWithMissingDefaults}
              defaults={currentStepDefaults}
            />
          </div>
        </CardContent>
      </Card>

      {pois.map((poi, index) => (
        <StepConfigCard
          key={poi.id}
          poi={poi}
          index={index}
          isExpanded={expandedId === poi.id}
          onToggle={() => setExpandedId(expandedId === poi.id ? null : poi.id)}
          onUpdateConfig={(updates) => updateStepConfig(poi.id, poi.step_config || {}, updates)}
          onDuplicate={() => handleDuplicate(poi)}
          languages={languages}
          isDuplicating={duplicatePOI.isPending}
          projectId={projectId}
          stepTypeLabels={stepTypeLabels}
          validationModeLabels={validationModeLabels}
          photoValidationLabels={photoValidationLabels}
        />
      ))}
    </div>
  );
}

interface StepConfigCardProps {
  poi: POI;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateConfig: (updates: Partial<StepConfig>) => void;
  onDuplicate: () => void;
  languages: SupportedLanguage[];
  isDuplicating: boolean;
  projectId: string;
  stepTypeLabels: Record<string, string>;
  validationModeLabels: Record<string, string>;
  photoValidationLabels: Record<string, string>;
}

function StepConfigCard({
  poi,
  index,
  isExpanded,
  onToggle,
  onUpdateConfig,
  onDuplicate,
  languages,
  isDuplicating,
  projectId,
  stepTypeLabels,
  validationModeLabels,
  photoValidationLabels,
}: StepConfigCardProps) {
  const config = poi.step_config || {};

  const hasContent = config.contentI18n?.fr;
  const hasPossibleTypes = config.possible_step_types && config.possible_step_types.length > 0;
  const hasPossibleModes = config.possible_validation_modes && config.possible_validation_modes.length > 0;
  
  // Summary badges
  const typeCount = config.possible_step_types?.length || 0;
  const modeCount = config.possible_validation_modes?.length || 0;

  return (
    <Card className={!hasContent || !hasPossibleTypes || !hasPossibleModes ? 'border-amber-300' : ''}>
      <CardHeader className="py-3 cursor-pointer" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
              #{index + 1}
            </span>
            <div>
              <CardTitle className="text-base">{poi.name}</CardTitle>
              <p className="text-xs text-muted-foreground">{poi.zone || 'Zone non définie'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {typeCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {typeCount} type{typeCount > 1 ? 's' : ''}
              </Badge>
            )}
            {modeCount > 0 && (
              <Badge variant="outline" className="text-xs">
                {modeCount} valid.
              </Badge>
            )}
            {config.final_step_type && (
              <Badge variant="default" className="text-xs">
                ✓ {stepTypeLabels[config.final_step_type]}
              </Badge>
            )}
            <Button 
              variant="ghost" 
              size="icon"
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
              disabled={isDuplicating}
              title="Dupliquer l'étape"
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          {/* Multi-select: Step Types */}
          <EnumCheckboxGroup<StepType>
            label="Possibilités d'étape (multi-sélection)"
            values={config.possible_step_types || []}
            onChange={(values) => onUpdateConfig({ possible_step_types: values })}
            options={stepTypeLabels}
          />

          {/* Multi-select: Validation Modes */}
          <EnumCheckboxGroup<ValidationMode>
            label="Possibilités de validation (multi-sélection)"
            values={config.possible_validation_modes || []}
            onChange={(values) => onUpdateConfig({ possible_validation_modes: values })}
            options={validationModeLabels}
          />

          {/* Optional: Final Decision Section */}
          <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
            <p className="text-sm font-medium">Décision finale (optionnel)</p>
            <p className="text-xs text-muted-foreground mb-2">
              Choisissez le type et mode final si la décision est prise
            </p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm">Type final</Label>
                <RadioGroup
                  value={config.final_step_type || ''}
                  onValueChange={(v) => onUpdateConfig({ final_step_type: v as StepType || null })}
                  className="flex flex-wrap gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="" id={`${poi.id}-type-none`} />
                    <Label htmlFor={`${poi.id}-type-none`} className="text-xs">Non décidé</Label>
                  </div>
                  {(config.possible_step_types || []).map((type) => (
                    <div key={type} className="flex items-center space-x-2">
                      <RadioGroupItem value={type} id={`${poi.id}-type-${type}`} />
                      <Label htmlFor={`${poi.id}-type-${type}`} className="text-xs">{stepTypeLabels[type]}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Validation finale</Label>
                <RadioGroup
                  value={config.final_validation_mode || ''}
                  onValueChange={(v) => onUpdateConfig({ final_validation_mode: v as ValidationMode || null })}
                  className="flex flex-wrap gap-2"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="" id={`${poi.id}-mode-none`} />
                    <Label htmlFor={`${poi.id}-mode-none`} className="text-xs">Non décidé</Label>
                  </div>
                  {(config.possible_validation_modes || []).map((mode) => (
                    <div key={mode} className="flex items-center space-x-2">
                      <RadioGroupItem value={mode} id={`${poi.id}-mode-${mode}`} />
                      <Label htmlFor={`${poi.id}-mode-${mode}`} className="text-xs">{validationModeLabels[mode]}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          </div>

          {/* Photo validation options - show if photo mode is selected */}
          {(config.possible_validation_modes?.includes('photo') || config.final_validation_mode === 'photo') && (
            <>
              <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
                <EnumSelect<PhotoValidationType>
                  label="Type de validation photo"
                  value={config.photoValidation?.type}
                  onChange={(v) => onUpdateConfig({ 
                    photoValidation: { ...config.photoValidation, type: v } 
                  })}
                  options={photoValidationLabels}
                  placeholder="Sélectionner..."
                />

                {config.photoValidation?.type === 'reference' && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">
                      URL de référence <span className="text-destructive">*</span>
                    </Label>
                    <input
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={config.photoValidation?.referenceUrl || ''}
                      onChange={(e) => onUpdateConfig({ 
                        photoValidation: { ...config.photoValidation, referenceUrl: e.target.value } 
                      })}
                      placeholder="https://..."
                    />
                  </div>
                )}

                {config.photoValidation?.type === 'qr_code' && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">
                      Valeur QR attendue <span className="text-destructive">*</span>
                    </Label>
                    <input
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={config.photoValidation?.qrExpectedValue || ''}
                      onChange={(e) => onUpdateConfig({ 
                        photoValidation: { ...config.photoValidation, qrExpectedValue: e.target.value } 
                      })}
                      placeholder="Valeur encodée dans le QR..."
                    />
                  </div>
                )}
              </div>

              {/* Photo Reference Block - for capturing reference photo */}
              <PhotoReferenceBlock
                photoReferenceRequired={config.photo_reference_required || false}
                referenceImageUrl={config.reference_image_url || null}
                referenceImageCaption={config.reference_image_caption || null}
                onUpdate={onUpdateConfig}
                projectId={projectId}
                stepId={poi.id}
              />
            </>
          )}

          {/* QR Code value - show if qr_code mode is selected */}
          {(config.possible_validation_modes?.includes('qr_code') || config.final_validation_mode === 'qr_code') && (
            <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm">
                  Valeur QR Code attendue <span className="text-destructive">*</span>
                </Label>
                <input
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={config.photoValidation?.qrExpectedValue || ''}
                  onChange={(e) => onUpdateConfig({ 
                    photoValidation: { ...config.photoValidation, qrExpectedValue: e.target.value } 
                  })}
                  placeholder="Valeur encodée dans le QR Code..."
                />
              </div>
            </div>
          )}

          {/* I18n Content - now optional */}
          <I18nInput
            label="Contenu de l'étape (optionnel)"
            value={config.contentI18n || {}}
            onChange={(v) => onUpdateConfig({ contentI18n: v })}
            languages={languages}
            multiline
            rows={3}
            frRequired={false}
            placeholder="Décrivez l'énigme, l'instruction ou le contenu..."
          />
        </CardContent>
      )}
    </Card>
  );
}
