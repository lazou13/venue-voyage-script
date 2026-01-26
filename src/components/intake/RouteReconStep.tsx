import { useState, useEffect, useRef } from 'react';
import { 
  Route, AlertTriangle, MapPin, Shield, Navigation, 
  Circle, Square, Plus, Download, Trash2, Clock, Ruler, MapPinned
} from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { useRouteRecorder, exportTraceAsGeoJSON, RouteTrace } from '@/hooks/useRouteRecorder';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { OptionMatrix } from './shared/OptionMatrix';
import type { QuestConfig, RouteReconDetails } from '@/types/intake';

// Check if admin mode is enabled
const isAdminMode = import.meta.env.VITE_ADMIN_MODE === 'true';

interface RouteReconStepProps {
  projectId: string;
}

// Format seconds to mm:ss
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Format meters to km or m
function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

export function RouteReconStep({ projectId }: RouteReconStepProps) {
  const { project, updateProject } = useProject(projectId);
  const { toast } = useToast();
  const { uploadFile, isUploading } = useFileUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const questConfig = project?.quest_config || {};
  const details = questConfig.route_recon_details || {};

  // Route recorder hook
  const {
    isRecording,
    currentTraceId,
    coords,
    liveStats,
    lastPosition,
    traces,
    isLoadingTraces,
    useTraceMarkers,
    startRecording,
    stopRecording,
    addMarker,
    deleteTrace,
  } = useRouteRecorder(projectId);

  // UI state
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [markerDialogOpen, setMarkerDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [traceToDelete, setTraceToDelete] = useState<string | null>(null);
  const [markerNote, setMarkerNote] = useState('');
  const [markerPhotoUrl, setMarkerPhotoUrl] = useState('');
  const [duration, setDuration] = useState(0);

  // Fetch markers for selected trace
  const markersQuery = useTraceMarkers(selectedTraceId);
  const markers = markersQuery.data || [];

  // Update duration every second when recording
  useEffect(() => {
    if (!isRecording) {
      setDuration(0);
      return;
    }
    const interval = setInterval(() => {
      setDuration(liveStats.duration);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording, liveStats.duration]);

  // Auto-select current trace when recording
  useEffect(() => {
    if (currentTraceId) {
      setSelectedTraceId(currentTraceId);
    }
  }, [currentTraceId]);

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

  const handleAddMarker = async () => {
    if (!currentTraceId || !lastPosition) {
      toast({ title: 'Erreur', description: 'Aucune position disponible', variant: 'destructive' });
      return;
    }

    await addMarker.mutateAsync({
      traceId: currentTraceId,
      lat: lastPosition.lat,
      lng: lastPosition.lng,
      note: markerNote || undefined,
      photoUrl: markerPhotoUrl || undefined,
    });

    setMarkerDialogOpen(false);
    setMarkerNote('');
    setMarkerPhotoUrl('');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, `route-markers/${projectId}`);
    if (url) {
      setMarkerPhotoUrl(url);
    }
  };

  const handleExportGeoJSON = (trace: RouteTrace) => {
    const traceMarkers = markers.filter(m => m.trace_id === trace.id);
    const geojsonString = exportTraceAsGeoJSON(trace, traceMarkers);
    
    const blob = new Blob([geojsonString], { type: 'application/geo+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trace-${trace.id.slice(0, 8)}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteTrace = async () => {
    if (traceToDelete) {
      await deleteTrace.mutateAsync(traceToDelete);
      if (selectedTraceId === traceToDelete) {
        setSelectedTraceId(null);
      }
    }
    setDeleteDialogOpen(false);
    setTraceToDelete(null);
  };

  const selectedTrace = traces.find(t => t.id === selectedTraceId);

  return (
    <div className="space-y-6">
      {/* Admin-only: Route Recording Section */}
      {isAdminMode && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Navigation className="w-5 h-5 text-primary" />
              Mode Repérage
              <Badge variant="secondary" className="text-xs">Admin</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recording controls */}
            <div className="flex items-center gap-3">
              {!isRecording ? (
                <Button 
                  onClick={startRecording} 
                  variant="default"
                  className="gap-2"
                >
                  <Circle className="w-4 h-4 fill-current" />
                  REC
                </Button>
              ) : (
                <Button 
                  onClick={stopRecording} 
                  variant="destructive"
                  className="gap-2"
                >
                  <Square className="w-4 h-4 fill-current" />
                  STOP
                </Button>
              )}

              {isRecording && (
                <Button
                  onClick={() => setMarkerDialogOpen(true)}
                  variant="outline"
                  className="gap-2"
                  disabled={!lastPosition}
                >
                  <Plus className="w-4 h-4" />
                  Ajouter marqueur
                </Button>
              )}
            </div>

            {/* Live stats when recording */}
            {isRecording && (
              <div className="grid grid-cols-3 gap-3">
                <div className="flex items-center gap-2 p-2 rounded-md bg-background border">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Durée</p>
                    <p className="font-mono font-medium">{formatDuration(duration)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-md bg-background border">
                  <Ruler className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Distance</p>
                    <p className="font-mono font-medium">{formatDistance(liveStats.distance)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-md bg-background border">
                  <MapPinned className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Points</p>
                    <p className="font-mono font-medium">{liveStats.points}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Current position */}
            {isRecording && lastPosition && (
              <div className="text-xs text-muted-foreground">
                Position: {lastPosition.lat.toFixed(6)}, {lastPosition.lng.toFixed(6)}
              </div>
            )}

            {/* Saved traces list */}
            {traces.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Traces enregistrées</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {traces.map(trace => (
                    <div 
                      key={trace.id}
                      onClick={() => setSelectedTraceId(trace.id)}
                      className={`flex items-center justify-between p-2 rounded-md border cursor-pointer transition-colors ${
                        selectedTraceId === trace.id ? 'border-primary bg-primary/10' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Route className="w-4 h-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(trace.created_at).toLocaleDateString('fr-FR')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {trace.distance_meters ? formatDistance(trace.distance_meters) : '-'} • 
                            {trace.geojson.coordinates.length} points
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportGeoJSON(trace);
                          }}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTraceToDelete(trace.id);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Markers for selected trace */}
            {selectedTrace && markers.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Marqueurs ({markers.length})</Label>
                <div className="space-y-1">
                  {markers.map((marker, idx) => (
                    <div key={marker.id} className="flex items-start gap-2 p-2 rounded bg-muted/30 text-sm">
                      <Badge variant="outline" className="shrink-0">{idx + 1}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted-foreground">
                          {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}
                        </p>
                        {marker.note && <p className="truncate">{marker.note}</p>}
                        {marker.photo_url && (
                          <img 
                            src={marker.photo_url} 
                            alt="Marker" 
                            className="mt-1 h-12 w-12 object-cover rounded"
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Simple map placeholder */}
            {selectedTrace && selectedTrace.geojson.coordinates.length > 0 && (
              <div className="border rounded-md p-4 bg-muted/20">
                <p className="text-xs text-muted-foreground mb-2">Aperçu trace (simplifié)</p>
                <svg 
                  viewBox="0 0 200 100" 
                  className="w-full h-24 border rounded bg-background"
                >
                  {(() => {
                    const coords = selectedTrace.geojson.coordinates;
                    if (coords.length < 2) return null;
                    
                    // Normalize coordinates to fit SVG
                    const lngs = coords.map(c => c[0]);
                    const lats = coords.map(c => c[1]);
                    const minLng = Math.min(...lngs);
                    const maxLng = Math.max(...lngs);
                    const minLat = Math.min(...lats);
                    const maxLat = Math.max(...lats);
                    const rangeLng = maxLng - minLng || 0.001;
                    const rangeLat = maxLat - minLat || 0.001;
                    
                    const points = coords.map(c => {
                      const x = ((c[0] - minLng) / rangeLng) * 180 + 10;
                      const y = 90 - ((c[1] - minLat) / rangeLat) * 80;
                      return `${x},${y}`;
                    }).join(' ');
                    
                    return (
                      <>
                        <polyline
                          points={points}
                          fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        {/* Start point */}
                        <circle
                          cx={((coords[0][0] - minLng) / rangeLng) * 180 + 10}
                          cy={90 - ((coords[0][1] - minLat) / rangeLat) * 80}
                          r="4"
                          fill="hsl(var(--primary))"
                        />
                        {/* End point */}
                        <circle
                          cx={((coords[coords.length-1][0] - minLng) / rangeLng) * 180 + 10}
                          cy={90 - ((coords[coords.length-1][1] - minLat) / rangeLat) * 80}
                          r="4"
                          fill="hsl(var(--destructive))"
                        />
                        {/* Markers */}
                        {markers.map((marker, i) => {
                          const x = ((marker.lng - minLng) / rangeLng) * 180 + 10;
                          const y = 90 - ((marker.lat - minLat) / rangeLat) * 80;
                          return (
                            <circle
                              key={marker.id}
                              cx={x}
                              cy={y}
                              r="3"
                              fill="hsl(var(--chart-1))"
                              stroke="white"
                              strokeWidth="1"
                            />
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
                <div className="flex gap-4 text-xs text-muted-foreground mt-2">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-primary" /> Départ
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-destructive" /> Arrivée
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-chart-1" /> Marqueurs
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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

      {/* Add Marker Dialog */}
      <Dialog open={markerDialogOpen} onOpenChange={setMarkerDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un marqueur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {lastPosition && (
              <p className="text-sm text-muted-foreground">
                Position: {lastPosition.lat.toFixed(6)}, {lastPosition.lng.toFixed(6)}
              </p>
            )}
            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea
                value={markerNote}
                onChange={(e) => setMarkerNote(e.target.value)}
                placeholder="Description du point..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Photo (optionnel)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              {markerPhotoUrl ? (
                <div className="relative">
                  <img 
                    src={markerPhotoUrl} 
                    alt="Preview" 
                    className="h-24 w-full object-cover rounded-md"
                  />
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 right-1 h-6 w-6"
                    onClick={() => setMarkerPhotoUrl('')}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? 'Upload...' : 'Choisir une photo'}
                </Button>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkerDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleAddMarker} disabled={addMarker.isPending}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Trace Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette trace ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La trace et tous ses marqueurs seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTrace}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
