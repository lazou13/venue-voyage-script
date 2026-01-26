import { useState } from 'react';
import { Wand2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { StepConfig } from '@/types/intake';

interface SelectiveApplyPanelProps {
  onApply: (fields: {
    stepType?: boolean;
    validationMode?: boolean;
    scoring?: boolean;
    hints?: boolean;
  }) => void;
  disabled?: boolean;
  stepsNeedingDefaults: number;
  defaults: Partial<StepConfig>;
}

export function SelectiveApplyPanel({
  onApply,
  disabled,
  stepsNeedingDefaults,
  defaults,
}: SelectiveApplyPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [fields, setFields] = useState({
    stepType: true,
    validationMode: true,
    scoring: true,
    hints: false,
  });

  const toggleField = (field: keyof typeof fields) => {
    setFields((prev) => ({ ...prev, [field]: !prev[field] }));
  };

  const handleApply = () => {
    onApply(fields);
    setIsOpen(false);
  };

  const anySelected = Object.values(fields).some(Boolean);

  if (stepsNeedingDefaults === 0) {
    return null;
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled} className="gap-1.5">
          <Wand2 className="w-4 h-4" />
          Appliquer défauts ({stepsNeedingDefaults})
          {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-2">
        <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
          <p className="text-sm text-muted-foreground">
            Sélectionnez les champs à appliquer aux étapes où ils sont manquants :
          </p>

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="field-stepType"
                checked={fields.stepType}
                onCheckedChange={() => toggleField('stepType')}
              />
              <Label htmlFor="field-stepType" className="text-sm">
                Type d'étape
                <span className="text-xs text-muted-foreground ml-1">
                  ({defaults.stepType || 'enigme'})
                </span>
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="field-validationMode"
                checked={fields.validationMode}
                onCheckedChange={() => toggleField('validationMode')}
              />
              <Label htmlFor="field-validationMode" className="text-sm">
                Validation
                <span className="text-xs text-muted-foreground ml-1">
                  ({defaults.validationMode || 'manual'})
                </span>
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="field-scoring"
                checked={fields.scoring}
                onCheckedChange={() => toggleField('scoring')}
              />
              <Label htmlFor="field-scoring" className="text-sm">
                Points
                <span className="text-xs text-muted-foreground ml-1">
                  ({defaults.scoring?.points || 10} pts)
                </span>
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="field-hints"
                checked={fields.hints}
                onCheckedChange={() => toggleField('hints')}
              />
              <Label htmlFor="field-hints" className="text-sm">
                Template indices
                <span className="text-xs text-muted-foreground ml-1">
                  ({defaults.hints?.length || 0} indices)
                </span>
              </Label>
            </div>
          </div>

          <Button
            size="sm"
            onClick={handleApply}
            disabled={disabled || !anySelected}
          >
            Appliquer aux {stepsNeedingDefaults} étape(s)
          </Button>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
