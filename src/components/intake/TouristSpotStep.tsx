import { MapPin, Flag, Clock, Landmark, Ban } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { OptionMatrix } from './shared/OptionMatrix';
import type { QuestConfig, TouristSpotDetails } from '@/types/intake';

interface TouristSpotStepProps {
  projectId: string;
}

export function TouristSpotStep({ projectId }: TouristSpotStepProps) {
  const { project, updateProject } = useProject(projectId);
  const { toast } = useToast();

  const questConfig = project?.quest_config || {};
  const details = questConfig.tourist_spot_details || {};

  const updateDetails = (updates: Partial<TouristSpotDetails>) => {
    const newQuestConfig: Partial<QuestConfig> = {
      ...questConfig,
      tourist_spot_details: { ...details, ...updates }
    };
    updateProject.mutate(
      { quest_config: newQuestConfig },
      { onSuccess: () => toast({ title: 'Sauvegardé' }) }
    );
  };

  const handleArrayChange = (field: keyof TouristSpotDetails, value: string) => {
    const items = value.split('\n').map(s => s.trim()).filter(Boolean);
    updateDetails({ [field]: items });
  };

  return (
    <div className="space-y-6">
      {/* Start Points */}
      <OptionMatrix 
        title="Points de départ" 
        icon={Flag}
        description="Lieux possibles pour commencer la quête"
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Points de départ</Label>
          <Textarea
            value={(details.start_points || []).join('\n')}
            onChange={(e) => handleArrayChange('start_points', e.target.value)}
            placeholder="Ex: Place principale&#10;Office de tourisme&#10;Parking visiteurs"
            rows={4}
          />
        </div>
      </OptionMatrix>

      {/* End Points */}
      <OptionMatrix 
        title="Points d'arrivée" 
        icon={MapPin}
        description="Lieux possibles pour terminer la quête"
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Points d'arrivée</Label>
          <Textarea
            value={(details.end_points || []).join('\n')}
            onChange={(e) => handleArrayChange('end_points', e.target.value)}
            placeholder="Ex: Café partenaire&#10;Boutique souvenirs&#10;Point de vue panoramique"
            rows={4}
          />
        </div>
      </OptionMatrix>

      {/* Landmarks */}
      <OptionMatrix 
        title="Points d'intérêt" 
        icon={Landmark}
        description="Monuments et lieux remarquables à intégrer"
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Landmarks</Label>
          <Textarea
            value={(details.landmarks || []).join('\n')}
            onChange={(e) => handleArrayChange('landmarks', e.target.value)}
            placeholder="Ex: Cathédrale&#10;Fontaine historique&#10;Statue du fondateur&#10;Ancien marché"
            rows={5}
          />
        </div>
      </OptionMatrix>

      {/* Avoid Zones */}
      <OptionMatrix 
        title="Zones à éviter" 
        icon={Ban}
        description="Zones dangereuses ou inappropriées"
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Zones à éviter</Label>
          <Textarea
            value={(details.avoid_zones || []).join('\n')}
            onChange={(e) => handleArrayChange('avoid_zones', e.target.value)}
            placeholder="Ex: Route principale (trafic)&#10;Chantier en cours&#10;Propriété privée"
            rows={4}
          />
        </div>
      </OptionMatrix>

      {/* Time Windows */}
      <OptionMatrix 
        title="Créneaux horaires" 
        icon={Clock}
        description="Horaires d'ouverture et contraintes temporelles"
      >
        <div className="space-y-1.5">
          <Label className="text-sm">Créneaux</Label>
          <Textarea
            value={(details.time_windows || []).join('\n')}
            onChange={(e) => handleArrayChange('time_windows', e.target.value)}
            placeholder="Ex: Musée: 10h-18h&#10;Église: fermée 12h-14h&#10;Marché: samedi matin uniquement"
            rows={4}
          />
        </div>
      </OptionMatrix>
    </div>
  );
}
