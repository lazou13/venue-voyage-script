import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProject } from '@/hooks/useProject';
import { CoreStep } from '@/components/intake/CoreStep';
import { EstablishmentStep } from '@/components/intake/EstablishmentStep';
import { TouristSpotStep } from '@/components/intake/TouristSpotStep';
import { RouteReconStep } from '@/components/intake/RouteReconStep';
import { FieldworkStep } from '@/components/intake/FieldworkStep';
import { StepsBuilderStep } from '@/components/intake/StepsBuilderStep';
import { RulesStep } from '@/components/intake/RulesStep';
import { OutputsStep } from '@/components/intake/OutputsStep';
import { ValidationPanel } from '@/components/intake/ValidationPanel';
import type { ProjectType } from '@/types/intake';

// Core steps that are always visible
const CORE_STEPS = [
  { id: 'core', label: 'Core', component: CoreStep },
];

// Type-specific steps
const TYPE_STEPS: Record<ProjectType, { id: string; label: string; component: React.ComponentType<{ projectId: string }> }> = {
  establishment: { id: 'establishment', label: 'Établissement', component: EstablishmentStep },
  tourist_spot: { id: 'tourist_spot', label: 'Site Touristique', component: TouristSpotStep },
  route_recon: { id: 'route_recon', label: 'Parcours', component: RouteReconStep },
};

// Common steps that are always visible
const COMMON_STEPS = [
  { id: 'fieldwork', label: 'Terrain', component: FieldworkStep },
  { id: 'steps', label: 'Étapes', component: StepsBuilderStep },
  { id: 'rules', label: 'Règles', component: RulesStep },
  { id: 'outputs', label: 'Exports', component: OutputsStep },
];

export default function IntakeForm() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('core');

  const { project, isLoading, validate } = useProject(projectId);
  const validation = validate();

  // Get project type from quest_config
  const projectType: ProjectType = project?.quest_config?.project_type || 'establishment';

  // Build dynamic steps based on project type
  const steps = useMemo(() => {
    const typeStep = TYPE_STEPS[projectType];
    return [
      ...CORE_STEPS,
      typeStep,
      ...COMMON_STEPS,
    ];
  }, [projectType]);

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
              onClick={() => setActiveTab('outputs')}
              disabled={!validation.isValid}
              variant={validation.isValid ? 'default' : 'outline'}
            >
              <Check className="w-4 h-4 mr-2" />
              Exports
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4">
        <ValidationPanel validation={validation} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList className="grid w-full mb-4" style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}>
            {steps.map((step) => (
              <TabsTrigger key={step.id} value={step.id} className="text-xs sm:text-sm">
                {step.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {steps.map((step) => (
            <TabsContent key={step.id} value={step.id}>
              <step.component projectId={projectId!} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
