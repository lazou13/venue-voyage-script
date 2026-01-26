import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Route, AlertTriangle, MapPin, Shield, Navigation, 
  Circle, Square, Plus, Download, Trash2, Clock, Ruler, MapPinned,
  Zap, Camera, X, Check, Copy, Package
} from 'lucide-react';
import JSZip from 'jszip';
import { useProject } from '@/hooks/useProject';
import { useRouteRecorder, exportTraceAsGeoJSON, buildMarkersCSV, buildReconBriefMarkdown, RouteTrace, RouteMarker, RecordingMode, RecordingStatus } from '@/hooks/useRouteRecorder';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { mapMarkerToPOI } from '@/lib/mapMarkerToPOI';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { OptionMatrix } from './shared/OptionMatrix';
import type { QuestConfig, RouteReconDetails, ProjectType } from '@/types/intake';
import type { Json } from '@/integrations/supabase/types';

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

  // Recording mode state
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('walking');

  // Route recorder hook
  const {
    status,
    errorMessage,
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
    addMarkerAtLastCoord,
    deleteTrace,
    retry,
  } = useRouteRecorder(projectId, recordingMode);

  // UI state
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [markerDialogOpen, setMarkerDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [traceToDelete, setTraceToDelete] = useState<string | null>(null);
  const [markerNote, setMarkerNote] = useState('');
  const [markerPhotoUrl, setMarkerPhotoUrl] = useState('');
  const [duration, setDuration] = useState(0);
  
  // Quick marker drawer state
  const [quickMarkerOpen, setQuickMarkerOpen] = useState(false);
  const [quickMarkerNote, setQuickMarkerNote] = useState('');
  const [quickMarkerPhoto, setQuickMarkerPhoto] = useState('');
  const [quickMarkerNumber, setQuickMarkerNumber] = useState(1);
  const [isSavingQuickMarker, setIsSavingQuickMarker] = useState(false);
  const quickMarkerFileRef = useRef<HTMLInputElement>(null);

  // Duplicate to project state
  const navigate = useNavigate();
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateTargetType, setDuplicateTargetType] = useState<ProjectType>('establishment');
  const [traceToDuplicate, setTraceToDuplicate] = useState<RouteTrace | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, setUrl: (url: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, `route-markers/${projectId}`);
    if (url) {
      setUrl(url);
    }
  };

  // Quick marker handlers
  const handleQuickMarkerOpen = () => {
    setQuickMarkerNote('');
    setQuickMarkerPhoto('');
    setQuickMarkerOpen(true);
  };

  const handleQuickMarkerSave = async () => {
    if (!lastPosition) {
      toast({ title: 'Erreur', description: 'Aucune position GPS', variant: 'destructive' });
      return;
    }
    
    setIsSavingQuickMarker(true);
    try {
      const note = quickMarkerNote.trim() || `Marker ${quickMarkerNumber}`;
      await addMarkerAtLastCoord(note, quickMarkerPhoto || undefined);
      setQuickMarkerNumber(n => n + 1);
      setQuickMarkerOpen(false);
      setQuickMarkerNote('');
      setQuickMarkerPhoto('');
    } catch (err) {
      toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsSavingQuickMarker(false);
    }
  };

  const handleQuickMarkerCancel = () => {
    setQuickMarkerOpen(false);
    setQuickMarkerNote('');
    setQuickMarkerPhoto('');
  };

  const handleQuickMarkerPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handlePhotoUpload(e, setQuickMarkerPhoto);
  };

  const handleMarkerPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handlePhotoUpload(e, setMarkerPhotoUrl);
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

  // Duplicate trace to new project
  const handleDuplicateToProject = async () => {
    if (!traceToDuplicate) return;
    
    setIsDuplicating(true);
    try {
      // Fetch markers for this trace
      const { data: traceMarkers, error: markersError } = await supabase
        .from('route_markers')
        .select('*')
        .eq('trace_id', traceToDuplicate.id)
        .order('created_at', { ascending: true });
      
      if (markersError) throw markersError;
      
      const traceName = traceToDuplicate.name || new Date(traceToDuplicate.created_at).toLocaleDateString('fr-FR');
      
      // Create new project
      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          hotel_name: traceName,
          city: '',
          title_i18n: { fr: traceName } as unknown as Json,
          story_i18n: {} as unknown as Json,
          quest_config: { project_type: duplicateTargetType } as unknown as Json,
        })
        .select()
        .single();
      
      if (projectError) throw projectError;
      
      // Create POIs from markers using the helper
      if (traceMarkers && traceMarkers.length > 0) {
        const poisToInsert = traceMarkers.map((marker, idx) => 
          mapMarkerToPOI(marker, idx, newProject.id)
        );
        
        const { error: poisError } = await supabase
          .from('pois')
          .insert(poisToInsert);
        
        if (poisError) throw poisError;
      }
      
      toast({ title: 'Projet créé', description: `${traceMarkers?.length || 0} POIs importés` });
      setDuplicateDialogOpen(false);
      setTraceToDuplicate(null);
      
      // Navigate to new project
      navigate(`/intake/${newProject.id}`);
    } catch (err) {
      toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsDuplicating(false);
    }
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
            {/* Mode selector */}
            <div className="flex items-center gap-4">
              <Label className="text-sm font-medium">Mode:</Label>
              <RadioGroup
                value={recordingMode}
                onValueChange={(v) => setRecordingMode(v as RecordingMode)}
                className="flex gap-4"
                disabled={isRecording}
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="walking" id="mode-walking" />
                  <Label htmlFor="mode-walking" className="text-sm cursor-pointer">
                    🚶 Marche
                  </Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="scooter" id="mode-scooter" />
                  <Label htmlFor="mode-scooter" className="text-sm cursor-pointer">
                    🛵 Scooter
                  </Label>
                </div>
              </RadioGroup>
              {isRecording && (
                <Badge variant="outline" className="text-xs">
                  Max: {recordingMode === 'walking' ? '12' : '25'} m/s
                </Badge>
              )}
            </div>

            {/* Error banner */}
            {status === 'error' && errorMessage && (
              <div className="flex items-center gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/30">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-destructive">Erreur GPS</p>
                  <p className="text-xs text-destructive/80">{errorMessage}</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={retry}
                  className="shrink-0"
                >
                  Réessayer
                </Button>
              </div>
            )}

            {/* Recording controls */}
            <div className="flex items-center gap-3">
              {!isRecording ? (
                <Button 
                  onClick={startRecording} 
                  variant="default"
                  className="gap-2"
                  disabled={status === 'error'}
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
                  onClick={handleQuickMarkerOpen}
                  variant="secondary"
                  className="gap-2"
                  disabled={!lastPosition || quickMarkerOpen}
                >
                  <Zap className="w-4 h-4" />
                  Marqueur rapide
                </Button>
              )}
            </div>

            {/* Quick marker inline drawer */}
            {isRecording && quickMarkerOpen && (
              <div className="p-3 rounded-md border border-primary/30 bg-primary/5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Marqueur rapide #{quickMarkerNumber}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={handleQuickMarkerCancel}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                <Textarea
                  placeholder="Note (optionnel)"
                  value={quickMarkerNote}
                  onChange={(e) => setQuickMarkerNote(e.target.value)}
                  className="min-h-[60px] text-sm"
                />
                
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    ref={quickMarkerFileRef}
                    onChange={handleQuickMarkerPhotoUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => quickMarkerFileRef.current?.click()}
                    disabled={isUploading}
                    className="gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    {isUploading ? 'Upload...' : 'Prendre photo'}
                  </Button>
                  {quickMarkerPhoto && (
                    <img 
                      src={quickMarkerPhoto} 
                      alt="Preview" 
                      className="h-10 w-10 object-cover rounded border"
                    />
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleQuickMarkerSave}
                    disabled={isSavingQuickMarker}
                    className="gap-2"
                  >
                    <Check className="w-4 h-4" />
                    Enregistrer
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleQuickMarkerCancel}
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}

            {/* Live stats when recording */}
            {isRecording && (
              <>
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
                <p className="text-xs text-muted-foreground">
                  💾 Sauvegarde auto: ON (15s)
                </p>
              </>
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
                          title="Dupliquer en projet"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTraceToDuplicate(trace);
                            setDuplicateDialogOpen(true);
                          }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Exporter GeoJSON"
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
                          title="Supprimer"
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
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="text-sm font-medium">Marqueurs ({markers.length})</Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        const md = buildReconBriefMarkdown(selectedTrace, markers, recordingMode);
                        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        const traceName = selectedTrace.name || new Date(selectedTrace.created_at).toISOString().slice(0, 10);
                        a.download = `recon_${traceName}.md`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="w-3 h-3" />
                      Brief (.md)
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        const csv = buildMarkersCSV(markers);
                        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        const traceName = selectedTrace.name || new Date(selectedTrace.created_at).toISOString().slice(0, 10);
                        a.download = `markers_${traceName}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                    >
                      <Download className="w-3 h-3" />
                      CSV
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-2"
                      onClick={async () => {
                        try {
                          const zip = new JSZip();
                          const traceName = selectedTrace.name || new Date(selectedTrace.created_at).toISOString().slice(0, 10);
                          const dateStr = new Date().toISOString().slice(0, 10);
                          
                          // 1. brief_reperage.md
                          const md = buildReconBriefMarkdown(selectedTrace, markers, recordingMode);
                          zip.file('brief_reperage.md', md);
                          
                          // 2. markers.csv
                          const csv = buildMarkersCSV(markers);
                          zip.file('markers.csv', csv);
                          
                          // 3. photos.txt (marker_title\tphoto_url)
                          const photosLines = markers
                            .filter(m => m.photo_url)
                            .map((m, idx) => `Marker ${idx + 1}\t${m.photo_url}`);
                          zip.file('photos.txt', photosLines.join('\n'));
                          
                          // 4. meta.json
                          const meta = {
                            projectId: projectId,
                            trackId: selectedTrace.id,
                            trackName: traceName,
                            createdAt: selectedTrace.created_at,
                            exportedAt: new Date().toISOString(),
                            mode: recordingMode,
                            markerCount: markers.length,
                            photoCount: photosLines.length,
                          };
                          zip.file('meta.json', JSON.stringify(meta, null, 2));
                          
                          // Generate and download
                          const content = await zip.generateAsync({ type: 'blob' });
                          const url = URL.createObjectURL(content);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `mission_pack_${traceName}_${dateStr}.zip`;
                          a.click();
                          URL.revokeObjectURL(url);
                          
                          toast({ title: 'Mission Pack exporté', description: '4 fichiers dans le ZIP' });
                        } catch (err) {
                          toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
                        }
                      }}
                    >
                      <Package className="w-3 h-3" />
                      Pack (.zip)
                    </Button>
                  </div>
                </div>
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
                onChange={handleMarkerPhotoUpload}
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

      {/* Duplicate to Project Modal */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dupliquer en projet</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Créer un nouveau projet à partir de cette trace. Les marqueurs seront importés comme POIs.
            </p>
            <div className="space-y-2">
              <Label>Type de projet cible</Label>
              <Select
                value={duplicateTargetType}
                onValueChange={(v) => setDuplicateTargetType(v as ProjectType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="establishment">Établissement (hôtel/venue)</SelectItem>
                  <SelectItem value="tourist_spot">Spot touristique</SelectItem>
                  <SelectItem value="route_recon">Repérage route</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {traceToDuplicate && (
              <div className="p-3 rounded-md bg-muted/50 text-sm">
                <p className="font-medium">
                  {traceToDuplicate.name || new Date(traceToDuplicate.created_at).toLocaleDateString('fr-FR')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {traceToDuplicate.geojson.coordinates.length} points GPS
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleDuplicateToProject} disabled={isDuplicating}>
              {isDuplicating ? 'Création...' : 'Créer le projet'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
