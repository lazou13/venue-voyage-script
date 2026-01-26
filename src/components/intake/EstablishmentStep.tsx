import { Building2, Wifi, Users, Lock } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { OptionMatrix } from './shared/OptionMatrix';
import type { QuestConfig, EstablishmentDetails } from '@/types/intake';

interface EstablishmentStepProps {
  projectId: string;
}

export function EstablishmentStep({ projectId }: EstablishmentStepProps) {
  const { project, updateProject } = useProject(projectId);
  const { toast } = useToast();

  const questConfig = project?.quest_config || {};
  const details = questConfig.establishment_details || {};

  const updateDetails = (updates: Partial<EstablishmentDetails>) => {
    const newQuestConfig: Partial<QuestConfig> = {
      ...questConfig,
      establishment_details: { ...details, ...updates }
    };
    updateProject.mutate(
      { quest_config: newQuestConfig },
      { onSuccess: () => toast({ title: 'Sauvegardé' }) }
    );
  };

  const handleArrayChange = (field: keyof EstablishmentDetails, value: string) => {
    const items = value.split('\n').map(s => s.trim()).filter(Boolean);
    updateDetails({ [field]: items });
  };

  return (
    <div className="space-y-6">
      {/* Spaces */}
      <OptionMatrix 
        title="Espaces utilisables" 
        icon={Building2}
        description="Listez les espaces accessibles pour la quête (un par ligne)"
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Espaces</Label>
          <Textarea
            value={(details.spaces || []).join('\n')}
            onChange={(e) => handleArrayChange('spaces', e.target.value)}
            placeholder="Ex: Hall d'entrée&#10;Restaurant&#10;Jardin intérieur&#10;Rooftop&#10;Couloirs 1er étage"
            rows={5}
          />
        </div>
      </OptionMatrix>

      {/* Private Zones */}
      <OptionMatrix 
        title="Zones privées" 
        icon={Lock}
        description="Zones avec accès restreint nécessitant autorisation"
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Zones privées</Label>
          <Textarea
            value={(details.private_zones || []).join('\n')}
            onChange={(e) => handleArrayChange('private_zones', e.target.value)}
            placeholder="Ex: Cuisine&#10;Bureau direction&#10;Réserve&#10;Vestiaires staff"
            rows={4}
          />
        </div>
      </OptionMatrix>

      {/* Staff Operations */}
      <OptionMatrix 
        title="Opérations staff" 
        icon={Users}
        description="Implication du personnel et contraintes opérationnelles"
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Notes opérationnelles</Label>
          <Textarea
            value={(details.staff_ops || []).join('\n')}
            onChange={(e) => handleArrayChange('staff_ops', e.target.value)}
            placeholder="Ex: Réceptionniste disponible pour indices&#10;Chef peut participer au briefing&#10;Éviter service midi (12h-14h)"
            rows={4}
          />
        </div>
      </OptionMatrix>

      {/* Wifi Notes */}
      <OptionMatrix 
        title="Notes Wi-Fi" 
        icon={Wifi}
        description="Remarques sur la connectivité par zone"
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Notes Wi-Fi</Label>
          <Textarea
            value={(details.wifi_notes || []).join('\n')}
            onChange={(e) => handleArrayChange('wifi_notes', e.target.value)}
            placeholder="Ex: Signal faible au sous-sol&#10;Bon signal restaurant&#10;Zone morte près ascenseurs"
            rows={4}
          />
        </div>
      </OptionMatrix>
    </div>
  );
}
