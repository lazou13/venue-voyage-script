import { useState } from 'react';
import { ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { usePOIs } from '@/hooks/usePOIs';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EnumSelect } from './shared/EnumSelect';
import { I18nInput } from './shared/I18nInput';
import type { 
  POI, 
  StepType, 
  ValidationMode, 
  PhotoValidationType,
  StepConfig,
  SupportedLanguage 
} from '@/types/intake';
import { 
  STEP_TYPE_LABELS, 
  VALIDATION_MODE_LABELS, 
  PHOTO_VALIDATION_LABELS 
} from '@/types/intake';

interface StepsBuilderStepProps {
  projectId: string;
}

export function StepsBuilderStep({ projectId }: StepsBuilderStepProps) {
  const { pois, project } = useProject(projectId);
  const { updatePOI } = usePOIs(projectId);
  const { toast } = useToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const languages = (project?.quest_config?.languages || ['fr']) as SupportedLanguage[];

  const updateStepConfig = (poiId: string, currentConfig: StepConfig, updates: Partial<StepConfig>) => {
    const newConfig = { ...currentConfig, ...updates };
    updatePOI.mutate(
      { id: poiId, step_config: newConfig },
      { onSuccess: () => toast({ title: 'Sauvegardé' }) }
    );
  };

  if (pois.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Settings2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Aucune étape définie</p>
          <p className="text-sm mt-1">Ajoutez des étapes dans l'onglet Fieldwork</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">Configuration des Étapes</h3>
          <p className="text-sm text-muted-foreground">
            Définissez le type, la validation et le contenu de chaque étape
          </p>
        </div>
        <Badge variant="outline">{pois.length} étapes</Badge>
      </div>

      {pois.map((poi, index) => (
        <StepConfigCard
          key={poi.id}
          poi={poi}
          index={index}
          isExpanded={expandedId === poi.id}
          onToggle={() => setExpandedId(expandedId === poi.id ? null : poi.id)}
          onUpdateConfig={(updates) => updateStepConfig(poi.id, poi.step_config || {}, updates)}
          languages={languages}
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
  languages: SupportedLanguage[];
}

function StepConfigCard({
  poi,
  index,
  isExpanded,
  onToggle,
  onUpdateConfig,
  languages,
}: StepConfigCardProps) {
  const config = poi.step_config || {};

  const hasContent = config.contentI18n?.fr;
  const hasType = config.stepType;
  const hasValidation = config.validationMode;

  return (
    <Card className={!hasContent || !hasType ? 'border-amber-300' : ''}>
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
            {hasType && (
              <Badge variant="secondary" className="text-xs">
                {STEP_TYPE_LABELS[config.stepType!]}
              </Badge>
            )}
            {hasValidation && (
              <Badge variant="outline" className="text-xs">
                {VALIDATION_MODE_LABELS[config.validationMode!]}
              </Badge>
            )}
            {!hasContent && (
              <Badge variant="destructive" className="text-xs">
                Contenu manquant
              </Badge>
            )}
            <Button variant="ghost" size="icon">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EnumSelect<StepType>
              label="Type d'étape"
              value={config.stepType}
              onChange={(v) => onUpdateConfig({ stepType: v })}
              options={STEP_TYPE_LABELS}
              placeholder="Sélectionner..."
              required
            />

            <EnumSelect<ValidationMode>
              label="Mode de validation"
              value={config.validationMode}
              onChange={(v) => onUpdateConfig({ validationMode: v })}
              options={VALIDATION_MODE_LABELS}
              placeholder="Sélectionner..."
            />
          </div>

          {/* Photo validation options */}
          {config.validationMode === 'photo' && (
            <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
              <EnumSelect<PhotoValidationType>
                label="Type de validation photo"
                value={config.photoValidation?.type}
                onChange={(v) => onUpdateConfig({ 
                  photoValidation: { ...config.photoValidation, type: v } 
                })}
                options={PHOTO_VALIDATION_LABELS}
                placeholder="Sélectionner..."
              />

              {config.photoValidation?.type === 'reference' && (
                <div className="space-y-1.5">
                  <Label className="text-sm">
                    URL de référence <span className="text-destructive">*</span>
                  </Label>
                  <Input
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
                  <Input
                    value={config.photoValidation?.qrExpectedValue || ''}
                    onChange={(e) => onUpdateConfig({ 
                      photoValidation: { ...config.photoValidation, qrExpectedValue: e.target.value } 
                    })}
                    placeholder="Valeur encodée dans le QR..."
                  />
                </div>
              )}
            </div>
          )}

          {/* GPS validation options */}
          {config.validationMode === 'auto_gps' && (
            <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
              <p className="text-sm font-medium">Configuration GPS</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Latitude <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={config.gps?.lat || ''}
                    onChange={(e) => onUpdateConfig({ 
                      gps: { ...config.gps, lat: parseFloat(e.target.value) || undefined } 
                    })}
                    placeholder="48.8566"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Longitude <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.000001"
                    value={config.gps?.lng || ''}
                    onChange={(e) => onUpdateConfig({ 
                      gps: { ...config.gps, lng: parseFloat(e.target.value) || undefined } 
                    })}
                    placeholder="2.3522"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    Rayon (m) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={config.gps?.radius || ''}
                    onChange={(e) => onUpdateConfig({ 
                      gps: { ...config.gps, radius: parseInt(e.target.value) || undefined } 
                    })}
                    placeholder="10"
                  />
                </div>
              </div>
            </div>
          )}

          {/* I18n Content */}
          <I18nInput
            label="Contenu de l'étape"
            value={config.contentI18n || {}}
            onChange={(v) => onUpdateConfig({ contentI18n: v })}
            languages={languages}
            multiline
            rows={3}
            frRequired
            placeholder="Décrivez l'énigme, l'instruction ou le contenu..."
          />
        </CardContent>
      )}
    </Card>
  );
}
