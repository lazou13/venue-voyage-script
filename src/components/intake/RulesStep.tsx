import { Award, Lightbulb, GitBranch, Users, Clock, Package } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { OptionMatrix, OptionRow } from './shared/OptionMatrix';
import type { QuestConfig, ScoringConfig, BranchingLogic } from '@/types/intake';

interface RulesStepProps {
  projectId: string;
}

export function RulesStep({ projectId }: RulesStepProps) {
  const { project, updateProject } = useProject(projectId);
  const { toast } = useToast();

  const questConfig = project?.quest_config || {};
  const scoring = questConfig.scoring || {};
  const hintRules = questConfig.hintRules || {};
  const branchingPresets = questConfig.branchingPresets || {};

  const updateQuestConfig = (updates: Partial<QuestConfig>) => {
    updateProject.mutate(
      { quest_config: { ...questConfig, ...updates } },
      { onSuccess: () => toast({ title: 'Sauvegardé' }) }
    );
  };

  const updateScoring = (updates: Partial<ScoringConfig>) => {
    updateQuestConfig({ scoring: { ...scoring, ...updates } });
  };

  const updateBranching = (updates: Partial<BranchingLogic>) => {
    updateQuestConfig({ branchingPresets: { ...branchingPresets, ...updates } });
  };

  const handleOperationalUpdate = (key: string, value: boolean | number | null) => {
    updateProject.mutate(
      { [key]: value },
      { onSuccess: () => toast({ title: 'Sauvegardé' }) }
    );
  };

  return (
    <div className="space-y-6">
      {/* Scoring Defaults */}
      <OptionMatrix 
        title="Points par défaut" 
        icon={Award}
        description="Points et pénalités appliqués à toutes les étapes"
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Points par étape</Label>
            <Input
              type="number"
              min={0}
              value={scoring.points || ''}
              onChange={(e) => updateScoring({ points: parseInt(e.target.value) || undefined })}
              placeholder="10"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Pénalité indice</Label>
            <Input
              type="number"
              min={0}
              value={scoring.hint_penalty || ''}
              onChange={(e) => updateScoring({ hint_penalty: parseInt(e.target.value) || undefined })}
              placeholder="2"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Pénalité échec</Label>
            <Input
              type="number"
              min={0}
              value={scoring.fail_penalty || ''}
              onChange={(e) => updateScoring({ fail_penalty: parseInt(e.target.value) || undefined })}
              placeholder="5"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Temps limite (sec)</Label>
            <Input
              type="number"
              min={0}
              value={scoring.time_limit_sec || ''}
              onChange={(e) => updateScoring({ time_limit_sec: parseInt(e.target.value) || undefined })}
              placeholder="300"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Bonus temps</Label>
            <Input
              type="number"
              min={0}
              value={scoring.time_bonus || ''}
              onChange={(e) => updateScoring({ time_bonus: parseInt(e.target.value) || undefined })}
              placeholder="5"
            />
          </div>
        </div>
      </OptionMatrix>

      {/* Hint Rules */}
      <OptionMatrix 
        title="Règles des indices" 
        icon={Lightbulb}
        description="Configuration globale des indices"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Nombre max d'indices</Label>
            <Input
              type="number"
              min={0}
              max={10}
              value={hintRules.maxHints || ''}
              onChange={(e) => updateQuestConfig({ 
                hintRules: { ...hintRules, maxHints: parseInt(e.target.value) || undefined } 
              })}
              placeholder="3"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Auto-révélation après (sec)</Label>
            <Input
              type="number"
              min={0}
              value={hintRules.autoRevealAfterSec || ''}
              onChange={(e) => updateQuestConfig({ 
                hintRules: { ...hintRules, autoRevealAfterSec: parseInt(e.target.value) || undefined } 
              })}
              placeholder="120"
            />
          </div>
        </div>
      </OptionMatrix>

      {/* Branching Logic Presets */}
      <OptionMatrix 
        title="Logique de branchement" 
        icon={GitBranch}
        description="Comportement par défaut après succès/échec"
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-sm">En cas de succès</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={branchingPresets.onSuccess || 'next'}
              onChange={(e) => updateBranching({ onSuccess: e.target.value })}
            >
              <option value="next">Étape suivante</option>
              <option value="intermediate">Intermédiaire (pause/direction)</option>
              <option value="end">Fin de quête</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">En cas d'échec</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={branchingPresets.onFailure || 'retry'}
              onChange={(e) => updateBranching({ onFailure: e.target.value })}
            >
              <option value="retry">Réessayer</option>
              <option value="next">Étape suivante</option>
              <option value="end">Fin de quête</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="space-y-1.5">
            <Label className="text-sm">Seuil score</Label>
            <Input
              type="number"
              min={0}
              value={branchingPresets.scoreAbove || ''}
              onChange={(e) => updateBranching({ scoreAbove: parseInt(e.target.value) || undefined })}
              placeholder="50"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Si au-dessus</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={branchingPresets.scoreAboveTarget || ''}
              onChange={(e) => updateBranching({ scoreAboveTarget: e.target.value || undefined })}
            >
              <option value="">Par défaut</option>
              <option value="next">Suivante</option>
              <option value="intermediate">Intermédiaire</option>
              <option value="end">Fin</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">Si en-dessous</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={branchingPresets.scoreBelowTarget || ''}
              onChange={(e) => updateBranching({ scoreBelowTarget: e.target.value || undefined })}
            >
              <option value="">Par défaut</option>
              <option value="retry">Réessayer</option>
              <option value="end">Fin</option>
            </select>
          </div>
        </div>
      </OptionMatrix>

      {/* Operational Constraints */}
      <OptionMatrix 
        title="Contraintes Opérationnelles"
        description="Configuration du staff et des props"
      >
        <OptionRow label="Staff disponible" description="Le personnel peut participer">
          <Switch
            checked={project?.staff_available || false}
            onCheckedChange={(v) => handleOperationalUpdate('staff_available', v)}
          />
        </OptionRow>

        <OptionRow label="Props autorisés" description="Objets physiques installables">
          <Switch
            checked={project?.props_allowed ?? true}
            onCheckedChange={(v) => handleOperationalUpdate('props_allowed', v)}
          />
        </OptionRow>

        <div className="p-3 border rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div>
              <Label className="text-sm">Temps de reset</Label>
              <p className="text-xs text-muted-foreground">Minutes entre deux sessions</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={120}
              value={project?.reset_time_mins || ''}
              onChange={(e) =>
                handleOperationalUpdate('reset_time_mins', e.target.value ? parseInt(e.target.value) : null)
              }
              placeholder="15"
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">minutes</span>
          </div>
        </div>
      </OptionMatrix>
    </div>
  );
}
