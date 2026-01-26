import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProject } from '@/hooks/useProject';
import { HotelInfoStep } from '@/components/intake/HotelInfoStep';
import { MapUploadStep } from '@/components/intake/MapUploadStep';
import { POIBuilderStep } from '@/components/intake/POIBuilderStep';
import { ZonesStep } from '@/components/intake/ZonesStep';
import { OpsStep } from '@/components/intake/OpsStep';
import { DesignStep } from '@/components/intake/DesignStep';
import { ValidationPanel } from '@/components/intake/ValidationPanel';

const STEPS = [
  { id: 'hotel', label: 'Hôtel', component: HotelInfoStep },
  { id: 'map', label: 'Carte', component: MapUploadStep },
  { id: 'pois', label: 'POIs', component: POIBuilderStep },
  { id: 'zones', label: 'Zones', component: ZonesStep },
  { id: 'ops', label: 'Ops', component: OpsStep },
  { id: 'design', label: 'Design', component: DesignStep },
];

export default function IntakeForm() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('hotel');

  const { project, pois, wifiZones, forbiddenZones, isLoading, validate } = useProject(projectId);
  const validation = validate();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Projet non trouvé</h2>
          <Button onClick={() => navigate('/')}>Retour au dashboard</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-semibold text-foreground">{project.hotel_name}</h1>
                <p className="text-xs text-muted-foreground">{project.city}</p>
              </div>
            </div>
            <Button
              onClick={() => navigate(`/intake/${projectId}/outputs`)}
              disabled={!validation.isValid}
            >
              <Check className="w-4 h-4 mr-2" />
              Générer Outputs
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4">
        <ValidationPanel validation={validation} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full grid-cols-6 mb-4">
            {STEPS.map((step) => (
              <TabsTrigger key={step.id} value={step.id} className="text-xs sm:text-sm">
                {step.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {STEPS.map((step) => (
            <TabsContent key={step.id} value={step.id}>
              <step.component projectId={projectId!} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
