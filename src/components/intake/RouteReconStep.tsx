import { Route, AlertTriangle, MapPin, Shield, Navigation } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { OptionMatrix } from './shared/OptionMatrix';
import type { QuestConfig, RouteReconDetails } from '@/types/intake';

interface RouteReconStepProps {
  projectId: string;
}

export function RouteReconStep({ projectId }: RouteReconStepProps) {
  const { project, updateProject } = useProject(projectId);
  const { toast } = useToast();

  const questConfig = project?.quest_config || {};
  const details = questConfig.route_recon_details || {};

  const updateDetails = (updates: Partial<RouteReconDetails>) => {
    const newQuestConfig: Partial<QuestConfig> = {
      ...questConfig,
      route_recon_details: { ...details, ...updates }
    };
    updateProject.mutate(
      { quest_config: newQuestConfig },
      { onSuccess: () => toast({ title: 'Sauvegardé' }) }
    );
  };

  const handleArrayChange = (field: keyof RouteReconDetails, value: string) => {
    const items = value.split('\n').map(s => s.trim()).filter(Boolean);
    updateDetails({ [field]: items });
  };

  return (
    <div className="space-y-6">
      {/* Route Type */}
      <OptionMatrix 
        title="Type de parcours" 
        icon={Route}
        description="Nature du parcours à reconnaître"
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Type de route</Label>
          <Input
            value={details.route_type || ''}
            onChange={(e) => updateDetails({ route_type: e.target.value })}
            placeholder="Ex: Urbain, Montagne, Côtier, Mixte..."
          />
        </div>
      </OptionMatrix>

      {/* Segments */}
      <OptionMatrix 
        title="Segments du parcours" 
        icon={Navigation}
        description="Découpez le parcours en segments (un par ligne)"
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Segments</Label>
          <Textarea
            value={(details.segments || []).join('\n')}
            onChange={(e) => handleArrayChange('segments', e.target.value)}
            placeholder="Ex: Départ → Carrefour Nord (2km)&#10;Carrefour Nord → Col (5km)&#10;Col → Arrivée village (3km)"
            rows={5}
          />
        </div>
      </OptionMatrix>

      {/* Danger Points */}
      <OptionMatrix 
        title="Points de danger" 
        icon={AlertTriangle}
        description="Zones nécessitant une attention particulière"
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Points dangereux</Label>
          <Textarea
            value={(details.danger_points || []).join('\n')}
            onChange={(e) => handleArrayChange('danger_points', e.target.value)}
            placeholder="Ex: Virage serré km 3&#10;Passage étroit km 7&#10;Traversée route principale km 12"
            rows={4}
          />
        </div>
      </OptionMatrix>

      {/* Mandatory Stops */}
      <OptionMatrix 
        title="Arrêts obligatoires" 
        icon={MapPin}
        description="Points de passage obligatoires"
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Arrêts</Label>
          <Textarea
            value={(details.mandatory_stops || []).join('\n')}
            onChange={(e) => handleArrayChange('mandatory_stops', e.target.value)}
            placeholder="Ex: Point de ravitaillement km 5&#10;Check-point sécurité km 10&#10;Point photo km 15"
            rows={4}
          />
        </div>
      </OptionMatrix>

      {/* Safety Brief */}
      <OptionMatrix 
        title="Consignes de sécurité" 
        icon={Shield}
        description="Instructions de sécurité pour les participants"
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Consignes</Label>
          <Textarea
            value={(details.safety_brief || []).join('\n')}
            onChange={(e) => handleArrayChange('safety_brief', e.target.value)}
            placeholder="Ex: Équipement obligatoire: casque, gilet&#10;Ne pas dépasser 30km/h en zone urbaine&#10;Signaler tout incident au 06..."
            rows={5}
          />
        </div>
      </OptionMatrix>
    </div>
  );
}
