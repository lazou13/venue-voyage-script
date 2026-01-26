import { useProject } from '@/hooks/useProject';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { DifficultyLevel } from '@/types/intake';
import { DIFFICULTY_LABELS } from '@/types/intake';
import { Timer, Gauge, Sparkles } from 'lucide-react';

interface DesignStepProps {
  projectId: string;
}

export function DesignStep({ projectId }: DesignStepProps) {
  const { project, updateProject } = useProject(projectId);
  const { toast } = useToast();

  const handleUpdate = (key: string, value: string | number | null) => {
    updateProject.mutate(
      { [key]: value },
      {
        onSuccess: () => {
          toast({ title: 'Sauvegardé' });
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Choix de Design</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Duration */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <Timer className="w-5 h-5 text-muted-foreground" />
            <div>
              <Label className="text-base">Durée cible</Label>
              <p className="text-sm text-muted-foreground">
                Durée idéale de l'expérience
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={15}
              max={180}
              value={project?.target_duration_mins || ''}
              onChange={(e) =>
                handleUpdate(
                  'target_duration_mins',
                  e.target.value ? parseInt(e.target.value) : null
                )
              }
              placeholder="60"
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">minutes</span>
          </div>
        </div>

        {/* Difficulty */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <Gauge className="w-5 h-5 text-muted-foreground" />
            <div>
              <Label className="text-base">Difficulté</Label>
              <p className="text-sm text-muted-foreground">
                Niveau de challenge souhaité
              </p>
            </div>
          </div>
          <Select
            value={project?.difficulty || ''}
            onValueChange={(v) => handleUpdate('difficulty', v as DifficultyLevel)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DIFFICULTY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Theme */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <Sparkles className="w-5 h-5 text-muted-foreground" />
            <div>
              <Label className="text-base">Thème narratif</Label>
              <p className="text-sm text-muted-foreground">
                Ambiance ou histoire souhaitée
              </p>
            </div>
          </div>
          <Textarea
            value={project?.theme || ''}
            onChange={(e) => handleUpdate('theme', e.target.value || null)}
            placeholder="Ex: Mystère années 20, Espionnage, Aventure familiale..."
            rows={3}
          />
        </div>
      </CardContent>
    </Card>
  );
}
