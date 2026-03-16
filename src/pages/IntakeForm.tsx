import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import type { ProjectType } from '@/types/intake';

// Core steps that are always visible
const CORE_STEPS = [
  { id: 'core', label: 'Core', component: CoreStep },
];

// Type-specific steps
const TYPE_STEPS: Record<ProjectType, { id: string; label: string; component: React.ComponentType<{ projectId: string; onNavigate?: (tab: string) => void }> }[]> = {
  establishment: [{ id: 'establishment', label: 'Établissement', component: EstablishmentStep }],
  tourist_spot: [
    { id: 'tourist_spot', label: 'Site Touristique', component: TouristSpotStep },
    { id: 'route_recon', label: 'Parcours', component: RouteReconStep },
  ],
  route_recon: [{ id: 'route_recon', label: 'Parcours', component: RouteReconStep }],
};

// Common steps that are always visible
const COMMON_STEPS = [
  { id: 'fieldwork', label: 'Terrain', component: FieldworkStep },
  { id: 'steps', label: 'Étapes', component: StepsBuilderStep },
  { id: 'rules', label: 'Règles', component: RulesStep },
  { id: 'outputs', label: 'Exports', component: OutputsStep },
];

  // Build dynamic steps based on project type
  const steps = useMemo(() => {
    const typeSteps = TYPE_STEPS[projectType];
    return [
      ...CORE_STEPS,
      ...typeSteps,
      ...COMMON_STEPS,
    ];
  }, [projectType]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Projet non trouvé</h2>
          <p className="text-muted-foreground mb-6">Ce projet n'existe pas ou a été supprimé.</p>
          <Button onClick={() => navigate('/')} className="rounded-full">
            Retour au dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Modern Header */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => navigate('/')}
                className="rounded-full shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="min-w-0">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="font-semibold text-foreground truncate bg-transparent border-none outline-none w-full focus:ring-1 focus:ring-primary/30 rounded px-1 -ml-1"
                  placeholder="Nom du projet..."
                />
                <input
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="text-xs text-muted-foreground truncate bg-transparent border-none outline-none w-full focus:ring-1 focus:ring-primary/30 rounded px-1 -ml-1"
                  placeholder="Ville / Lieu..."
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              {validation.isValid && (
                <Badge className="bg-success/10 text-success rounded-full gap-1 hidden sm:flex">
                  <Check className="w-3 h-3" />
                  Prêt
                </Badge>
              )}
              <Button
                onClick={() => setActiveTab('outputs')}
                disabled={!validation.isValid}
                className={cn(
                  "rounded-full gap-2 shadow-soft",
                  validation.isValid ? "hover:shadow-glow" : ""
                )}
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden sm:inline">Exports</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4">
        <ValidationPanel validation={validation} />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
          <TabsList 
            className="grid w-full mb-6 p-1.5 bg-muted/50 rounded-2xl"
            style={{ gridTemplateColumns: `repeat(${steps.length}, 1fr)` }}
          >
            {steps.map((step, index) => (
              <TabsTrigger 
                key={step.id} 
                value={step.id} 
                className={cn(
                  "text-xs sm:text-sm rounded-xl transition-all data-[state=active]:shadow-soft",
                  "data-[state=active]:bg-background data-[state=active]:text-foreground"
                )}
                style={{ animationDelay: `${index * 30}ms` }}
              >
                {step.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {steps.map((step) => (
            <TabsContent key={step.id} value={step.id} className="animate-fade-in">
              <step.component projectId={projectId!} onNavigate={setActiveTab} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
