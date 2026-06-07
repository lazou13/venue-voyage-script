import { useState, useEffect, useMemo } from 'react';
import { Copy, Download, Check, AlertCircle, AlertTriangle, BarChart3, Loader2, RotateCcw, Pencil, Sparkles } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { useAvatars } from '@/hooks/useAvatars';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { EnumSelect } from './shared/EnumSelect';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { generateChecklist, generatePRD, generatePrompt, generateVisitReportMD, generateRoadBook } from '@/lib/outputGenerators';
import { supabase } from '@/integrations/supabase/client';
import { InteractiveReportViewer } from './InteractiveReportViewer';
import { RoadBookMap } from './RoadBookMap';
import type { LineString } from 'geojson';
import type { RouteTrace, RouteMarker } from '@/hooks/useRouteRecorder';

interface OutputsStepProps {
  projectId: string;
}

export function OutputsStep({ projectId }: OutputsStepProps) {
  const { project, pois, wifiZones, forbiddenZones, validate } = useProject(projectId);
  const { avatars } = useAvatars(projectId);
  const { toast } = useToast();

  // ============= Route Recon: state for Rapport tab (hooks MUST be before returns) =============
  const [reportTrace, setReportTrace] = useState<RouteTrace | null>(null);
  const [reportMarkers, setReportMarkers] = useState<RouteMarker[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [roadBookContent, setRoadBookContent] = useState<string | null>(null);

  // ============= Story Architect (geo_series) state =============
  const [seriesFormat, setSeriesFormat] = useState<'marrakech_secrets' | 'dossier_secret' | 'chronicles' | 'insolent_guide'>('marrakech_secrets');
  const [seriesTone, setSeriesTone] = useState<'mysterious' | 'insolent' | 'family' | 'premium'>('mysterious');
  const [seriesGoal, setSeriesGoal] = useState<'fun_share' | 'cultural_immersive' | 'light_investigation'>('cultural_immersive');
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [seriesError, setSeriesError] = useState<string | null>(null);
  const [seriesResult, setSeriesResult] = useState<{ generated?: number; cached?: number; skipped?: number; error?: number } | null>(null);
  const [seriesConfirmOpen, setSeriesConfirmOpen] = useState(false);

  // Compute projectType early for useEffect dependency
  const projectType = project?.quest_config?.project_type || 'establishment';
  const isRouteRecon = projectType === 'route_recon';
  const projectLoadedId = project?.id ?? null;

  // Fetch trace + markers for route_recon projects
  useEffect(() => {
    // Only fetch for route_recon projects with a loaded project
    if (!isRouteRecon || !project) return;

    let isMounted = true;
    
    const fetchReportData = async () => {
      setReportLoading(true);
      setReportError(null);

      try {
        // Query 1: Get ALL traces for this project
        const { data: traces, error: tracesError } = await supabase
          .from('route_traces')
          .select('id, project_id, name, geojson, started_at, ended_at, distance_meters, created_at')
          .eq('project_id', projectId)
          .order('created_at', { ascending: true });

        if (tracesError) throw tracesError;
        
        // Filter traces with valid coordinates
        const validTraces = (traces || []).filter(t => {
          const geojson = t.geojson as unknown as LineString;
          return geojson?.coordinates?.length >= 2;
        });

        if (!isMounted) return;

        if (validTraces.length === 0) {
          setReportTrace(null);
          setReportMarkers([]);
          setReportLoading(false);
          return;
        }

        // Build merged trace from ALL valid traces
        const allCoords = validTraces.flatMap(t => (t.geojson as unknown as LineString).coordinates);
        const totalDistance = validTraces.reduce((sum, t) => sum + (t.distance_meters ? Number(t.distance_meters) : 0), 0);
        const allStartedAts = validTraces.map(t => t.started_at).filter(Boolean) as string[];
        const allEndedAts = validTraces.map(t => t.ended_at).filter(Boolean) as string[];

        const mergedTrace: RouteTrace = {
          id: 'merged',
          project_id: projectId,
          name: validTraces.length === 1 ? validTraces[0].name : `${validTraces.length} traces fusionnées`,
          geojson: { type: 'LineString', coordinates: allCoords },
          distance_meters: totalDistance || null,
          started_at: allStartedAts.length ? allStartedAts.sort()[0] : null,
          ended_at: allEndedAts.length ? allEndedAts.sort().reverse()[0] : null,
          created_at: validTraces[0].created_at,
        };

        // Query 2: Get markers for ALL traces
        const allTraceIds = validTraces.map(t => t.id);
        const { data: markers, error: markersError } = await supabase
          .from('route_markers')
          .select('id, trace_id, lat, lng, note, photo_url, photo_urls, audio_url, promoted, created_at')
          .in('trace_id', allTraceIds)
          .order('created_at', { ascending: true });

        if (markersError) throw markersError;
        if (!isMounted) return;

        const typedMarkers: RouteMarker[] = (markers || []).map(m => ({
          id: m.id,
          trace_id: m.trace_id,
          lat: Number(m.lat),
          lng: Number(m.lng),
          note: m.note,
          photo_url: m.photo_url,
          photo_urls: m.photo_urls || [],
          audio_url: m.audio_url || null,
          created_at: m.created_at,
          promoted: m.promoted ?? false,
        }));

        setReportTrace(mergedTrace);
        setReportMarkers(typedMarkers);
      } catch (err) {
        if (isMounted) {
          setReportError((err as Error).message || 'Erreur lors du chargement');
        }
      } finally {
        if (isMounted) {
          setReportLoading(false);
        }
      }
    };

    fetchReportData();

    return () => {
      isMounted = false;
    };
  }, [projectId, isRouteRecon, projectLoadedId]);
  // ============= End Route Recon fetch =============

  // Road Book editable content - hooks must be before early returns
  const roadBookData = useMemo(() => {
    if (!project) return '';
    return generateRoadBook({ project, pois, wifiZones, forbiddenZones, avatars });
  }, [project, pois, wifiZones, forbiddenZones, avatars]);

  useEffect(() => {
    if (roadBookContent === null && roadBookData) {
      setRoadBookContent(roadBookData);
    }
  }, [roadBookData, roadBookContent]);

  const currentRoadBook = roadBookContent ?? roadBookData;
  const isRoadBookModified = currentRoadBook !== roadBookData;

  const validation = validate();

  // Add avatar count warning (non-blocking)
  const avatarCountWarning = 'Moins de 10 avatars disponibles (recommandé: 10+)';
  if (avatars.length < 10 && !validation.warnings.includes(avatarCountWarning)) {
    validation.warnings.push(avatarCountWarning);
  }

  const copyToClipboard = (content: string, label: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: 'Copié!',
      description: `${label} copié dans le presse-papier`,
    });
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ============= Story Architect handler =============
  const orderedPoiIds = useMemo(
    () => [...pois].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((p) => p.id),
    [pois]
  );
  const seriesPoiIds = orderedPoiIds.slice(0, 8);

  const handleGenerateSeries = async () => {
    setSeriesConfirmOpen(false);
    if (!projectId || seriesPoiIds.length === 0) return;
    setSeriesLoading(true);
    setSeriesError(null);
    setSeriesResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('story-architect', {
        body: {
          project_id: projectId,
          poi_ids: seriesPoiIds,
          format: seriesFormat,
          tone: seriesTone,
          goal: seriesGoal,
          language: 'fr',
          dry_run: false,
        },
      });
      if (error) throw error;
      const summary = (data as { summary?: { generated?: number; cached?: number; skipped?: number; error?: number } })?.summary ?? {};
      setSeriesResult(summary);
      toast({
        title: 'Série générée',
        description: 'Ouvrez le player pour vérifier les épisodes.',
      });
    } catch (err) {
      const msg = (err as Error).message || 'Erreur inconnue';
      setSeriesError(msg);
      toast({
        title: 'Erreur de génération',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setSeriesLoading(false);
    }
  };


  if (!project) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Projet non chargé</p>
        </CardContent>
      </Card>
    );
  }

  // Validation panel
  if (!validation.isValid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Validation incomplète
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Corrigez les erreurs suivantes avant de générer les outputs:
          </p>
          <ul className="space-y-2">
            {validation.errors.map((error, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                {error}
              </li>
            ))}
          </ul>
          {validation.warnings.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground mt-4">Avertissements (non bloquants):</p>
              <ul className="space-y-2">
                {validation.warnings.map((warning, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const data = { project, pois, wifiZones, forbiddenZones, avatars };
  const isIntakeProject = projectType !== 'route_recon';
  
  // Build outputs array
  const outputs = [
    { id: 'checklist', label: 'Checklist', content: generateChecklist(data) },
    { id: 'prd', label: 'PRD', content: generatePRD(data) },
    { id: 'prompt', label: 'Prompt', content: generatePrompt(data) },
    ...(isIntakeProject ? [{ id: 'compte_rendu', label: 'Compte-rendu', content: generateVisitReportMD(data) }] : []),
    { id: 'road_book', label: 'Road Book', content: currentRoadBook },
    ...(isRouteRecon ? [{ id: 'rapport', label: 'Rapport', content: '' }] : []),
  ];
  
  // Compute grid columns based on number of tabs
  const tabCount = outputs.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
        <Check className="w-5 h-5 text-primary" />
        <span className="text-foreground font-medium">Validation réussie - Outputs prêts</span>
        <Badge variant="secondary" className="ml-auto">
          {pois.length} étapes
        </Badge>
      </div>

      {validation.warnings.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg border border-muted">
          <p className="text-sm font-medium text-muted-foreground mb-2">Avertissements:</p>
          <ul className="space-y-1">
            {validation.warnings.slice(0, 3).map((warning, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {warning}
              </li>
            ))}
            {validation.warnings.length > 3 && (
              <li className="text-xs text-muted-foreground">
                + {validation.warnings.length - 3} autres...
              </li>
            )}
          </ul>
        </div>
      )}

      {/* ============= Story Architect (geo_series) block ============= */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Série interactive géolocalisée
          </CardTitle>
          <CardDescription>
            Générez une couche narrative Story Architect pour transformer les POI de ce projet en épisodes :
            hook, scène, mission, révélation, cliffhanger.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {orderedPoiIds.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Ajoutez d'abord des étapes dans l'onglet Étapes.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {orderedPoiIds.length > 8 && (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Seuls les 8 premiers POI seront utilisés pour cette première génération.
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <EnumSelect
                  label="Format"
                  value={seriesFormat}
                  onChange={(v) => setSeriesFormat(v)}
                  options={{
                    marrakech_secrets: 'Les Secrets de Marrakech',
                    dossier_secret: 'Le Dossier Secret',
                    chronicles: 'Les Chroniques de Marrakech',
                    insolent_guide: 'Guide Insolent',
                  }}
                />
                <EnumSelect
                  label="Ton"
                  value={seriesTone}
                  onChange={(v) => setSeriesTone(v)}
                  options={{
                    mysterious: 'Mystérieux',
                    insolent: 'Insolent',
                    family: 'Familial',
                    premium: 'Premium',
                  }}
                />
                <EnumSelect
                  label="Objectif"
                  value={seriesGoal}
                  onChange={(v) => setSeriesGoal(v)}
                  options={{
                    fun_share: 'Fun & partage',
                    cultural_immersive: 'Culturel immersif',
                    light_investigation: 'Enquête légère',
                  }}
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => setSeriesConfirmOpen(true)}
                  disabled={seriesLoading || seriesPoiIds.length === 0}
                  className="gap-2"
                >
                  {seriesLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  Générer la série
                </Button>
                <span className="text-xs text-muted-foreground">
                  {seriesPoiIds.length} POI sélectionnés (sur {orderedPoiIds.length})
                </span>
              </div>

              {seriesResult && (
                <Alert>
                  <Check className="h-4 w-4" />
                  <AlertTitle>Série générée. Ouvrez le player pour vérifier les épisodes.</AlertTitle>
                  <AlertDescription className="mt-2 text-xs">
                    generated: {seriesResult.generated ?? 0} · cached: {seriesResult.cached ?? 0} · skipped:{' '}
                    {seriesResult.skipped ?? 0} · error: {seriesResult.error ?? 0}
                  </AlertDescription>
                </Alert>
              )}

              {seriesError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erreur</AlertTitle>
                  <AlertDescription>{seriesError}</AlertDescription>
                </Alert>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={seriesConfirmOpen} onOpenChange={setSeriesConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la génération</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action va écrire une couche narrative dans les POI de ce projet.
              Les visites classiques ne seront pas modifiées.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleGenerateSeries}>Confirmer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs defaultValue="checklist">

        <TabsList className={`grid w-full mb-4`} style={{ gridTemplateColumns: `repeat(${tabCount}, minmax(0, 1fr))` }}>
          {outputs.map((output) => (
            <TabsTrigger key={output.id} value={output.id} className="text-xs sm:text-sm">
              {output.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {outputs.map((output) => (
          <TabsContent key={output.id} value={output.id}>
            {/* Special handling for Rapport tab */}
            {output.id === 'rapport' ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Rapport Interactif
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {reportLoading ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Chargement des données...</p>
                    </div>
                  ) : reportError ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <AlertCircle className="w-8 h-8 text-destructive" />
                      <p className="text-sm text-destructive">{reportError}</p>
                    </div>
                  ) : !reportTrace ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4 text-muted-foreground">
                      <BarChart3 className="w-12 h-12 opacity-30" />
                      <p className="text-sm">Aucune trace disponible pour ce projet</p>
                      <p className="text-xs">Enregistrez un parcours dans l'onglet "Parcours" pour générer un rapport.</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                      <div className="text-center space-y-1">
                        <p className="text-sm text-muted-foreground">
                          Trace: <span className="font-medium text-foreground">{reportTrace.name || 'Sans nom'}</span>
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {reportTrace.geojson.coordinates.length} points • {reportMarkers.length} marqueurs
                        </p>
                      </div>
                      <Button onClick={() => setShowReport(true)} className="gap-2">
                        <BarChart3 className="w-4 h-4" />
                        Ouvrir le Rapport Interactif
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : output.id === 'road_book' ? (
              /* Editable Road Book tab */
              <Card>
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Pencil className="w-4 h-4" />
                    {output.label}
                    {isRoadBookModified && (
                      <Badge variant="outline" className="text-xs ml-2">Modifié</Badge>
                    )}
                  </CardTitle>
                  <div className="flex gap-2">
                    {isRoadBookModified && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRoadBookContent(roadBookData)}
                        title="Réinitialiser à la version générée"
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Reset
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(currentRoadBook, output.label)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copier
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        downloadFile(
                          currentRoadBook,
                          `RoadBook_${project.hotel_name.replace(/\s+/g, '_')}.md`
                        )
                      }
                    >
                      <Download className="w-4 h-4 mr-1" />
                      .md
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Interactive map for route_recon projects */}
                  {isRouteRecon && reportMarkers.length > 0 && (
                    <RoadBookMap
                      markers={reportMarkers.map((m, i) => ({
                        lat: m.lat,
                        lng: m.lng,
                        name: pois[i]?.name || `Marqueur ${i + 1}`,
                      }))}
                    />
                  )}
                  <textarea
                    className="w-full min-h-[60vh] text-sm bg-muted p-4 rounded-lg font-mono border border-border focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                    value={currentRoadBook}
                    onChange={(e) => setRoadBookContent(e.target.value)}
                  />
                </CardContent>
              </Card>
            ) : (
              /* Standard output tabs */
              <Card>
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className="text-lg">{output.label}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(output.content, output.label)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copier
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        downloadFile(
                          output.content,
                          output.id === 'compte_rendu' 
                            ? `compte_rendu_${project.hotel_name.replace(/\s+/g, '_')}.md`
                            : `${project.hotel_name.replace(/\s+/g, '_')}_${output.id}.md`
                        )
                      }
                    >
                      <Download className="w-4 h-4 mr-1" />
                      .md
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-auto max-h-[60vh] font-mono">
                    {output.content}
                  </pre>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Interactive Report Dialog for route_recon */}
      {isRouteRecon && reportTrace && (
        <InteractiveReportViewer
          open={showReport}
          onOpenChange={setShowReport}
          trace={reportTrace}
          markers={reportMarkers}
          projectName={project.hotel_name}
          projectCity={project.city}
          questConfig={project.quest_config as Record<string, unknown>}
          poisCount={pois.length}
        />
      )}
    </div>
  );
}
