import { useProject } from '@/hooks/useProject';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { Users, Clock, Package } from 'lucide-react';

interface OpsStepProps {
  projectId: string;
}

export function OpsStep({ projectId }: OpsStepProps) {
  const { project, updateProject } = useProject(projectId);
  const { toast } = useToast();

  const handleUpdate = (key: string, value: boolean | number | null) => {
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
        <CardTitle>Contraintes Opérationnelles</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Staff Availability */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-muted-foreground" />
            <div>
              <Label className="text-base">Staff disponible</Label>
              <p className="text-sm text-muted-foreground">
                Le personnel peut-il participer à l'animation?
              </p>
            </div>
          </div>
          <Switch
            checked={project?.staff_available || false}
            onCheckedChange={(v) => handleUpdate('staff_available', v)}
          />
        </div>

        {/* Reset Time */}
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-3 mb-3">
            <Clock className="w-5 h-5 text-muted-foreground" />
            <div>
              <Label className="text-base">Temps de reset</Label>
              <p className="text-sm text-muted-foreground">
                Combien de minutes entre deux sessions?
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={120}
              value={project?.reset_time_mins || ''}
              onChange={(e) =>
                handleUpdate('reset_time_mins', e.target.value ? parseInt(e.target.value) : null)
              }
              placeholder="Ex: 15"
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">minutes</span>
          </div>
        </div>

        {/* Props Allowed */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-muted-foreground" />
            <div>
              <Label className="text-base">Props autorisés</Label>
              <p className="text-sm text-muted-foreground">
                Peut-on installer des objets physiques dans l'hôtel?
              </p>
            </div>
          </div>
          <Switch
            checked={project?.props_allowed ?? true}
            onCheckedChange={(v) => handleUpdate('props_allowed', v)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
