import { useState } from 'react';
import { QrCode, MapPin, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { QUEST_PRESETS, type QuestPreset } from '@/lib/questPresets';
import type { QuestConfig, StepConfig } from '@/types/intake';

const PRESET_ICONS = {
  qr: QrCode,
  gps: MapPin,
  family: Users,
};

interface PresetSelectorProps {
  onApplyPreset: (
    questConfig: Partial<QuestConfig>,
    stepDefaults: Partial<StepConfig>,
    applyToExisting: boolean
  ) => void;
  hasExistingSteps: boolean;
  disabled?: boolean;
}

export function PresetSelector({ onApplyPreset, hasExistingSteps, disabled }: PresetSelectorProps) {
  const [selectedPreset, setSelectedPreset] = useState<QuestPreset | null>(null);
  const [applyToExisting, setApplyToExisting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handlePresetClick = (preset: QuestPreset) => {
    setSelectedPreset(preset);
    if (hasExistingSteps) {
      setShowConfirm(true);
    } else {
      onApplyPreset(preset.questConfig, preset.stepDefaults, false);
    }
  };

  const handleConfirm = () => {
    if (selectedPreset) {
      onApplyPreset(selectedPreset.questConfig, selectedPreset.stepDefaults, applyToExisting);
    }
    setShowConfirm(false);
    setApplyToExisting(false);
    setSelectedPreset(null);
  };

  const handleCancel = () => {
    setShowConfirm(false);
    setApplyToExisting(false);
    setSelectedPreset(null);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {QUEST_PRESETS.map((preset) => {
          const Icon = PRESET_ICONS[preset.icon];
          return (
            <Button
              key={preset.id}
              variant="outline"
              size="sm"
              onClick={() => handlePresetClick(preset)}
              disabled={disabled}
              className="gap-1.5"
            >
              <Icon className="w-4 h-4" />
              {preset.name}
            </Button>
          );
        })}
      </div>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md bg-background">
          <DialogHeader>
            <DialogTitle>Appliquer le preset "{selectedPreset?.name}"</DialogTitle>
            <DialogDescription>
              {selectedPreset?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Ce preset va mettre à jour la configuration globale de la quête.
            </p>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="apply-existing"
                checked={applyToExisting}
                onCheckedChange={(v) => setApplyToExisting(v === true)}
              />
              <Label htmlFor="apply-existing" className="text-sm">
                Appliquer aussi aux étapes existantes (seulement les champs manquants)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              Annuler
            </Button>
            <Button onClick={handleConfirm}>
              Appliquer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
