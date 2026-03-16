import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { 
  Route, AlertTriangle, MapPin, Shield, Navigation, 
  Circle, Square, Plus, Download, Trash2, Clock, Ruler, MapPinned,
  Zap, Camera, X, Check, Copy, Package, Flag, Compass, Mic, MicOff, Volume2, Library, Upload
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCrossTabStats } from '@/hooks/useCrossTabStats';
import { CrossTabSummary } from './CrossTabSummary';
import JSZip from 'jszip';
import { useProject } from '@/hooks/useProject';
import { useRouteRecorder, exportTraceAsGeoJSON, buildMarkersCSV, buildReconBriefMarkdown, RouteTrace, RouteMarker, RecordingMode, RecordingStatus } from '@/hooks/useRouteRecorder';
import { RouteGuidanceView } from './RouteGuidanceView';
import { GuidanceErrorBoundary } from '@/components/GuidanceErrorBoundary';
import { InteractiveReportViewer } from './InteractiveReportViewer';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useWakeLock } from '@/hooks/useWakeLock';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
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
import { Checkbox } from '@/components/ui/checkbox';
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
import { PhotoLightbox, type LightboxPhoto } from './shared/PhotoLightbox';
import { MarkerDetailSheet } from './MarkerDetailSheet';
import { RouteReconMap } from './RouteReconMap';
import type { QuestConfig, RouteReconDetails, ProjectType } from '@/types/intake';
import type { Json } from '@/integrations/supabase/types';


interface RouteReconStepProps {
  projectId: string;
  onNavigate?: (tab: string) => void;
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

export function RouteReconStep({ projectId, onNavigate }: RouteReconStepProps) {
  const { project, pois, updateProject, traces: projectTraces } = useProject(projectId);
  const stats = useCrossTabStats(project, pois, projectTraces);
  const { toast } = useToast();
  const { uploadFile, isUploading } = useFileUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const questConfig = project?.quest_config || {};
  const isLibraryMode = questConfig.project_type === 'library';
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
    deleteMarker,
    updateMarker,
    createManualTrace,
    rebuildTraceGeojson,
    retry,
  } = useRouteRecorder(projectId, recordingMode);

  // Wake lock - keep screen on during recording
  useWakeLock(isRecording);

  // Voice recorder
  const voiceRecorder = useVoiceRecorder();

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
  const [quickMarkerPhotos, setQuickMarkerPhotos] = useState<string[]>([]);
  const [quickMarkerAudioUrl, setQuickMarkerAudioUrl] = useState('');
  const [quickMarkerNumber, setQuickMarkerNumber] = useState(1);
  const [isSavingQuickMarker, setIsSavingQuickMarker] = useState(false);
  const [quickMarkerSaved, setQuickMarkerSaved] = useState(false);
  
  // AI analysis state
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  // Per-marker AI analysis state (for trace list)
  const [markerAnalyses, setMarkerAnalyses] = useState<Record<string, any>>({});
  const [analyzingMarkerId, setAnalyzingMarkerId] = useState<string | null>(null);
  const [expandedAnalysisId, setExpandedAnalysisId] = useState<string | null>(null);
  const quickMarkerFileRef = useRef<HTMLInputElement>(null);
  const quickMarkerFileBrowseRef = useRef<HTMLInputElement>(null);
  
  // Departure marker state
  const [departureMarked, setDepartureMarked] = useState(false);
  
  // Reset departure marker when recording stops, but auto-mark if traces already exist
  useEffect(() => {
    if (isRecording) {
      const hasExistingTraces = traces.some(t => {
        const geo = t.geojson as any;
        const coords = geo?.coordinates;
        return coords && coords.length > 0;
      });
      if (hasExistingTraces) setDepartureMarked(true);
    } else {
      setDepartureMarked(false);
    }
  }, [isRecording, traces]);

  // Duplicate to project state
  const navigate = useNavigate();
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [duplicateTargetType, setDuplicateTargetType] = useState<ProjectType>('establishment');
  const [traceToDuplicate, setTraceToDuplicate] = useState<RouteTrace | null>(null);
  const [isDuplicating, setIsDuplicating] = useState(false);
  
  // Guidance view state
  const [guidanceTrace, setGuidanceTrace] = useState<RouteTrace | null>(null);
  
  // Interactive report dialog state
  const [showReport, setShowReport] = useState(false);
  const [guidanceMarkers, setGuidanceMarkers] = useState<RouteMarker[]>([]);
  
  // Photo lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Manual marker form state
  const [manualFormOpen, setManualFormOpen] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [manualNote, setManualNote] = useState('');
  const [manualPhotoUrl, setManualPhotoUrl] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);
  const manualPhotoRef = useRef<HTMLInputElement>(null);

  // Delete marker confirm state
  const [markerToDelete, setMarkerToDelete] = useState<{ id: string; traceId: string } | null>(null);

  // Edit marker dialog state
  const [editingMarker, setEditingMarker] = useState<RouteMarker | null>(null);
  const [editLat, setEditLat] = useState('');
  const [editLng, setEditLng] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editPhotoUrl, setEditPhotoUrl] = useState('');
  const [editAudioUrl, setEditAudioUrl] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const editPhotoRef = useRef<HTMLInputElement>(null);

  // Auto-save feedback for manual form
  const [manualSaved, setManualSaved] = useState(false);

  // Promotion state
  const [selectedForPromotion, setSelectedForPromotion] = useState<Set<string>>(new Set());
  const [isPromoting, setIsPromoting] = useState(false);

  // Detail sheet state
  const [detailMarkerId, setDetailMarkerId] = useState<string | null>(null);

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

  // Local state for debounced textarea fields
  const [localSegments, setLocalSegments] = useState(details.segments?.join('\n') || '');
  const [localDangerPoints, setLocalDangerPoints] = useState(details.danger_points?.join('\n') || '');
  const [localMandatoryStops, setLocalMandatoryStops] = useState(details.mandatory_stops?.join('\n') || '');
  const [localSafetyBrief, setLocalSafetyBrief] = useState(details.safety_brief?.join('\n') || '');
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync local state when server data changes
  useEffect(() => { setLocalSegments(details.segments?.join('\n') || ''); }, [JSON.stringify(details.segments)]);
  useEffect(() => { setLocalDangerPoints(details.danger_points?.join('\n') || ''); }, [JSON.stringify(details.danger_points)]);
  useEffect(() => { setLocalMandatoryStops(details.mandatory_stops?.join('\n') || ''); }, [JSON.stringify(details.mandatory_stops)]);
  useEffect(() => { setLocalSafetyBrief(details.safety_brief?.join('\n') || ''); }, [JSON.stringify(details.safety_brief)]);

  const handleDebouncedArrayChange = (field: keyof RouteReconDetails, value: string, setLocal: (v: string) => void) => {
    setLocal(value);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      const items = value.split('\n').map(s => s.trim()).filter(Boolean);
      updateDetails({ [field]: items });
    }, 500);
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

  // Open edit dialog for a marker
  const handleOpenEditMarker = (marker: RouteMarker) => {
    setEditingMarker(marker);
    setEditLat(String(marker.lat));
    setEditLng(String(marker.lng));
    setEditNote(marker.note || '');
    setEditPhotoUrl(marker.photo_url || '');
    setEditAudioUrl(marker.audio_url || '');
  };

  // Save edited marker
  const handleSaveEditMarker = async () => {
    if (!editingMarker) return;
    const lat = parseFloat(editLat);
    const lng = parseFloat(editLng);
    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      toast({ title: 'Coordonnées invalides', variant: 'destructive' });
      return;
    }
    setIsSavingEdit(true);
    try {
      await updateMarker.mutateAsync({
        markerId: editingMarker.id,
        traceId: editingMarker.trace_id,
        lat,
        lng,
        note: editNote || null,
        photoUrl: editPhotoUrl || null,
        audioUrl: editAudioUrl || null,
      });
      setEditingMarker(null);
    } catch (err) {
      toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Manual marker add handler
  const handleAddManualMarker = async () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || lat < -90 || lat > 90 || isNaN(lng) || lng < -180 || lng > 180) {
      toast({ title: 'Coordonnées invalides', description: 'Latitude: -90 à 90, Longitude: -180 à 180', variant: 'destructive' });
      return;
    }

    setIsSavingManual(true);
    try {
      let traceId = selectedTraceId;
      // Create manual trace if none selected
      if (!traceId) {
        const trace = await createManualTrace.mutateAsync();
        traceId = trace.id;
        setSelectedTraceId(traceId);
      }

      await addMarker.mutateAsync({
        traceId,
        lat,
        lng,
        note: manualNote || undefined,
        photoUrl: manualPhotoUrl || undefined,
      });

      // Rebuild geojson
      await rebuildTraceGeojson(traceId);

      // Reset form but keep it open
      setManualLat('');
      setManualLng('');
      setManualNote('');
      setManualPhotoUrl('');
      // Show saved feedback
      setManualSaved(true);
      setTimeout(() => setManualSaved(false), 1200);
    } catch (err) {
      toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsSavingManual(false);
    }
  };

  // Auto-save manual marker when photo is uploaded (if lat/lng filled)
  const handleManualPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, `route-markers/${projectId}`);
    if (url) {
      setManualPhotoUrl(url);
      // Auto-save if coordinates are filled
      const lat = parseFloat(manualLat);
      const lng = parseFloat(manualLng);
      if (!isNaN(lat) && lat >= -90 && lat <= 90 && !isNaN(lng) && lng >= -180 && lng <= 180) {
        setIsSavingManual(true);
        try {
          let traceId = selectedTraceId;
          if (!traceId) {
            const trace = await createManualTrace.mutateAsync();
            traceId = trace.id;
            setSelectedTraceId(traceId);
          }
          await addMarker.mutateAsync({
            traceId,
            lat,
            lng,
            note: manualNote || undefined,
            photoUrl: url,
          });
          await rebuildTraceGeojson(traceId);
          setManualLat('');
          setManualLng('');
          setManualNote('');
          setManualPhotoUrl('');
          setManualSaved(true);
          setTimeout(() => setManualSaved(false), 1200);
        } catch (err) {
          toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
        } finally {
          setIsSavingManual(false);
        }
      }
    }
  };

  // Quick marker handlers
  const handleQuickMarkerOpen = () => {
    setQuickMarkerNote('');
    setQuickMarkerPhotos([]);
    setQuickMarkerAudioUrl('');
    setQuickMarkerSaved(false);
    voiceRecorder.clearAudio();
    setQuickMarkerOpen(true);
  };

  // Trigger AI analysis in background
  const triggerAiAnalysis = async (photoUrl?: string, audioUrl?: string) => {
    if (!lastPosition) return;
    setIsAnalyzing(true);
    setAiError(null);
    setAiAnalysis(null);
    try {
      // Fetch existing POIs for duplicate detection
      const { data: existingPois } = await supabase
        .from('medina_pois')
        .select('name, category, zone, lat, lng')
        .eq('is_active', true)
        .limit(100);

      // Fetch nearby markers from same project for context (Strategy A)
      const nearbyMarkers = markers
        .filter(m => {
          if (!lastPosition) return false;
          const dlat = m.lat - lastPosition.lat;
          const dlng = m.lng - lastPosition.lng;
          const distApprox = Math.sqrt(dlat * dlat + dlng * dlng) * 111000; // rough meters
          return distApprox < 200 && m.note; // within 200m and has a note
        })
        .slice(0, 10)
        .map(m => ({ lat: m.lat, lng: m.lng, note: m.note, photo_url: m.photo_url, audio_url: m.audio_url }));

      const { data, error } = await supabase.functions.invoke('analyze-marker', {
        body: {
          photo_url: photoUrl || undefined,
          audio_url: audioUrl || undefined,
          lat: lastPosition.lat,
          lng: lastPosition.lng,
          note: quickMarkerNote.trim() || undefined,
          existing_pois: existingPois || [],
          nearby_markers: nearbyMarkers,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiAnalysis(data.analysis);
    } catch (err) {
      const msg = (err as Error).message || 'Erreur analyse IA';
      setAiError(msg);
      console.error('AI analysis error:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleQuickMarkerSave = async () => {
    if (!lastPosition) {
      toast({ title: 'Erreur', description: 'Aucune position GPS', variant: 'destructive' });
      return;
    }
    
    setIsSavingQuickMarker(true);
    try {
      const note = quickMarkerNote.trim() || `Marker ${quickMarkerNumber}`;
      const finalPhotos = quickMarkerPhotos;
      const finalAudio = quickMarkerAudioUrl || undefined;
      await addMarkerAtLastCoord(note, finalPhotos.length ? finalPhotos[0] : undefined, finalAudio, finalPhotos.length ? finalPhotos : undefined);
      setQuickMarkerNumber(n => n + 1);
      // Close immediately — AI deferred to trace list
      setQuickMarkerOpen(false);
      setQuickMarkerNote('');
      setQuickMarkerPhotos([]);
      setQuickMarkerAudioUrl('');
      setQuickMarkerSaved(false);
      toast({ title: 'Marqueur sauvegardé ✓' });
    } catch (err) {
      toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsSavingQuickMarker(false);
    }
  };

  const handleQuickMarkerCancel = () => {
    if (voiceRecorder.isRecording) voiceRecorder.stopRecording();
    setQuickMarkerOpen(false);
    setQuickMarkerNote('');
    setQuickMarkerPhotos([]);
    setQuickMarkerAudioUrl('');
    setQuickMarkerSaved(false);
  };

  // Apply AI analysis to last saved marker
  const handleApplyAiAnalysis = async () => {
    if (!aiAnalysis || !markers.length) return;
    const lastMarker = markers[markers.length - 1];
    if (!lastMarker) return;
    
    const enrichedNote = [
      `📍 ${aiAnalysis.location_guess}`,
      `📂 ${aiAnalysis.category}${aiAnalysis.sub_category ? ` / ${aiAnalysis.sub_category}` : ''}`,
      '',
      '📖 Guide:',
      aiAnalysis.guide_narration?.fr || '',
      '',
      '🏛️ Anecdote:',
      aiAnalysis.historical_anecdote || '',
      '',
      '📚 Bibliothèque:',
      aiAnalysis.summary_library || '',
    ].join('\n');

    try {
      await updateMarker.mutateAsync({
        markerId: lastMarker.id,
        traceId: lastMarker.trace_id,
        lat: lastMarker.lat,
        lng: lastMarker.lng,
        note: enrichedNote,
        photoUrl: lastMarker.photo_url || null,
        audioUrl: lastMarker.audio_url || null,
      });
      toast({ title: 'Analyse appliquée', description: 'Note du marqueur enrichie par l\'IA' });
      setQuickMarkerOpen(false);
      setQuickMarkerNote('');
      setQuickMarkerPhotos([]);
      setQuickMarkerAudioUrl('');
      setQuickMarkerSaved(false);
      setAiAnalysis(null);
    } catch (err) {
      toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
    }
  };

  // Trigger AI analysis for a specific marker in the trace list
  const triggerMarkerAnalysis = async (marker: RouteMarker) => {
    setAnalyzingMarkerId(marker.id);
    try {
      const { data: existingPois } = await supabase
        .from('medina_pois')
        .select('name, category, zone, lat, lng')
        .eq('is_active', true)
        .limit(100);

      const nearbyMarkers = markers
        .filter(m => {
          const dlat = m.lat - marker.lat;
          const dlng = m.lng - marker.lng;
          const distApprox = Math.sqrt(dlat * dlat + dlng * dlng) * 111000;
          return distApprox < 200 && m.note && m.id !== marker.id;
        })
        .slice(0, 10)
        .map(m => ({ lat: m.lat, lng: m.lng, note: m.note, photo_url: m.photo_url, audio_url: m.audio_url }));

      const { data, error } = await supabase.functions.invoke('analyze-marker', {
        body: {
          photo_url: marker.photo_url || undefined,
          audio_url: marker.audio_url || undefined,
          lat: marker.lat,
          lng: marker.lng,
          note: marker.note || undefined,
          existing_pois: existingPois || [],
          nearby_markers: nearbyMarkers,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMarkerAnalyses(prev => ({ ...prev, [marker.id]: data.analysis }));
      setExpandedAnalysisId(marker.id);
    } catch (err) {
      toast({ title: 'Erreur analyse IA', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setAnalyzingMarkerId(null);
    }
  };

  // Analyze all markers in the selected trace
  const triggerAnalyzeAll = async () => {
    const toAnalyze = markers.filter(m => (m.photo_url || m.audio_url) && !markerAnalyses[m.id]);
    if (toAnalyze.length === 0) {
      toast({ title: 'Rien à analyser', description: 'Tous les marqueurs sont déjà analysés ou sans média' });
      return;
    }
    for (const m of toAnalyze) {
      await triggerMarkerAnalysis(m);
    }
    toast({ title: `${toAnalyze.length} marqueur(s) analysé(s)` });
  };

  // Approve marker analysis: merge into note
  const handleApproveMarkerAnalysis = async (markerId: string) => {
    const analysis = markerAnalyses[markerId];
    const marker = markers.find(m => m.id === markerId);
    if (!analysis || !marker) return;

    const enrichedNote = [
      `📍 ${analysis.location_guess}`,
      `📂 ${analysis.category}${analysis.sub_category ? ` / ${analysis.sub_category}` : ''}`,
      '',
      '📖 Guide:',
      analysis.guide_narration?.fr || '',
      '',
      '🏛️ Anecdote:',
      analysis.historical_anecdote || '',
      '',
      '📚 Bibliothèque:',
      analysis.summary_library || '',
    ].join('\n');

    try {
      await updateMarker.mutateAsync({
        markerId: marker.id,
        traceId: marker.trace_id,
        lat: marker.lat,
        lng: marker.lng,
        note: enrichedNote,
        photoUrl: marker.photo_url || null,
        audioUrl: marker.audio_url || null,
      });
      toast({ title: 'Analyse approuvée', description: 'Note enrichie par l\'IA' });
      setExpandedAnalysisId(null);
    } catch (err) {
      toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
    }
  };

  // Approve + promote to library in one action
  const handleApproveAndPromote = async (markerId: string) => {
    const analysis = markerAnalyses[markerId];
    const marker = markers.find(m => m.id === markerId);
    if (!marker) {
      toast({ title: 'Marqueur introuvable', variant: 'destructive' });
      return;
    }

    try {
      // 1. Enrich the note only if analysis exists
      if (analysis) {
        const enrichedNote = [
          `📍 ${analysis.location_guess}`,
          `📂 ${analysis.category}${analysis.sub_category ? ` / ${analysis.sub_category}` : ''}`,
          '',
          '📖 Guide:',
          analysis.guide_narration?.fr || '',
          '',
          '🏛️ Anecdote:',
          analysis.historical_anecdote || '',
          '',
          '📚 Bibliothèque:',
          analysis.summary_library || '',
          '',
          ...(analysis.nearby_restaurants?.length > 0 ? [
            '🍽️ Restaurants:',
            ...analysis.nearby_restaurants.map((r: any) => {
              const parts = [`- ${r.name} — ${r.specialty} (${r.price_range}) ⭐ ${r.rating}`];
              if (r.menu_url) parts.push(`  🍽️ Carte: ${r.menu_url}`);
              if (r.google_maps_query) parts.push(`  📍 Maps: ${r.google_maps_query}`);
              if (r.google_reviews?.length > 0) {
                parts.push(`  📝 Avis:`);
                r.google_reviews.slice(0, 5).forEach((rev: any) => {
                  parts.push(`    "${rev.text}" — ${rev.author} ⭐${rev.rating}`);
                });
              }
              return parts.join('\n');
            }),
            '',
          ] : []),
          ...(analysis.nearby_pois?.length > 0 ? [
            '🏛️ POIs proches:',
            ...analysis.nearby_pois.map((p: any) => {
              const parts = [`- ${p.name} (${p.type}) — ${p.description_fr}`];
              if (p.ticket_url) parts.push(`  🎫 Billets: ${p.ticket_url}`);
              if (p.ticket_price) parts.push(`  💰 Tarif: ${p.ticket_price}`);
              if (p.opening_hours) parts.push(`  🕐 Horaires: ${p.opening_hours}`);
              return parts.join('\n');
            }),
          ] : []),
        ].join('\n');

        await updateMarker.mutateAsync({
          markerId: marker.id,
          traceId: marker.trace_id,
          lat: marker.lat,
          lng: marker.lng,
          note: enrichedNote,
          photoUrl: marker.photo_url || null,
          audioUrl: marker.audio_url || null,
        });
      }

      // 2. Promote to library (with or without AI analysis)
      const { error } = await supabase.functions.invoke('promote-marker-to-library', {
        body: { marker_id: markerId, ai_analysis: analysis || null },
      });
      if (error) throw error;

      toast({
        title: 'Approuvé + Bibliothèque',
        description: analysis
          ? 'Note enrichie et POI créé en bibliothèque (draft)'
          : 'POI créé en bibliothèque (draft) — sans enrichissement IA',
      });
      setExpandedAnalysisId(null);
      markersQuery.refetch();
    } catch (err) {
      toast({ title: 'Erreur promotion', description: (err as Error).message, variant: 'destructive' });
    }
  };

  // Correct marker analysis: open edit dialog with pre-filled note
  const handleCorrectMarkerAnalysis = (markerId: string) => {
    const analysis = markerAnalyses[markerId];
    const marker = markers.find(m => m.id === markerId);
    if (!analysis || !marker) return;

    const prefilled = [
      `📍 ${analysis.location_guess}`,
      `📂 ${analysis.category}${analysis.sub_category ? ` / ${analysis.sub_category}` : ''}`,
      '',
      '📖 Guide:',
      analysis.guide_narration?.fr || '',
      '',
      '🏛️ Anecdote:',
      analysis.historical_anecdote || '',
      '',
      '📚 Bibliothèque:',
      analysis.summary_library || '',
    ].join('\n');

    setEditingMarker(marker);
    setEditLat(String(marker.lat));
    setEditLng(String(marker.lng));
    setEditNote(prefilled);
    setEditPhotoUrl(marker.photo_url || '');
    setEditAudioUrl(marker.audio_url || '');
  };


  const handleQuickMarkerPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, `route-markers/${projectId}`);
    if (url) {
      setQuickMarkerPhotos(prev => [...prev, url]);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  };

  // Voice recording upload handler
  const handleVoiceUpload = async (blob: Blob) => {
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: blob.type || 'audio/webm' });
    const url = await uploadFile(file, `voice-notes/${projectId}`);
    if (url) {
      setQuickMarkerAudioUrl(url);
    }
  };

  // Auto-upload when voice recording stops
  useEffect(() => {
    if (voiceRecorder.audioBlob) {
      handleVoiceUpload(voiceRecorder.audioBlob);
    }
  }, [voiceRecorder.audioBlob]);

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
      {!isLibraryMode && <CrossTabSummary tab="parcours" stats={stats} onNavigate={onNavigate} />}

      {/* Library mode: POI counter */}
      {isLibraryMode && (
        <Card className="border-amber-300 bg-amber-50">
          <CardContent className="py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <Library className="w-6 h-6 text-amber-600" />
              <div>
                <p className="font-semibold text-lg">{markers.length} POI{markers.length !== 1 ? 's' : ''} collecté{markers.length !== 1 ? 's' : ''}</p>
                <p className="text-xs text-muted-foreground">
                  {markers.filter(m => m.promoted).length} promu{markers.filter(m => m.promoted).length !== 1 ? 's' : ''} en bibliothèque
                </p>
              </div>
            </div>
            {markers.length > 0 && markers.some(m => !m.promoted) && (
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                disabled={isPromoting}
                onClick={async () => {
                  const unpromoted = markers.filter(m => !m.promoted);
                  if (unpromoted.length === 0) return;
                  setIsPromoting(true);
                  let successCount = 0;
                  for (const m of unpromoted) {
                    try {
                      const { error } = await supabase.functions.invoke('promote-marker-to-library', {
                        body: { marker_id: m.id },
                      });
                      if (!error) successCount++;
                    } catch {}
                  }
                  setIsPromoting(false);
                  markersQuery.refetch();
                  if (successCount > 0) {
                    toast({ title: `${successCount} POI${successCount > 1 ? 's' : ''} promu${successCount > 1 ? 's' : ''} en bibliothèque` });
                  }
                }}
              >
                <Upload className="w-4 h-4" />
                {isPromoting ? 'Promotion...' : `Tout promouvoir (${markers.filter(m => !m.promoted).length})`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}
      {/* Route Recording Section */}
      <Card className="border-primary/50 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Navigation className="w-5 h-5 text-primary" />
            Mode Repérage
          </CardTitle>
        </CardHeader>
        
        {/* Bandeau Guidage proéminent - masqué en mode bibliothèque */}
        {!isLibraryMode && (() => {
          const validTraceCount = traces.filter(t => t.geojson.coordinates.length >= 2).length;
          const hasValidTraces = validTraceCount > 0;
          
          return (
            <div className="mx-6 mb-2">
              <div className={`flex items-center gap-3 p-3 rounded-md border ${
                hasValidTraces 
                  ? 'bg-blue-50 border-blue-200' 
                  : 'bg-muted/50 border-border'
              }`}>
                <Compass className={`w-5 h-5 flex-shrink-0 ${
                  hasValidTraces ? 'text-blue-600' : 'text-muted-foreground'
                }`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    hasValidTraces ? 'text-blue-900' : 'text-muted-foreground'
                  }`}>
                    {hasValidTraces ? 'Mode Guidage disponible' : 'Mode Guidage'}
                  </p>
                  <p className={`text-xs ${
                    hasValidTraces ? 'text-blue-600' : 'text-muted-foreground/70'
                  }`}>
                    {hasValidTraces 
                      ? `${validTraceCount} trace(s) prête(s)` 
                      : 'Enregistrez une trace pour activer'}
                  </p>
                </div>
                <Button 
                  variant="default" 
                  className={`gap-2 ${
                    hasValidTraces 
                      ? 'bg-blue-600 hover:bg-blue-700' 
                      : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                  disabled={!hasValidTraces}
                  onClick={async () => {
                    if (!hasValidTraces) return;
                    const validTraces = traces.filter(t => t.geojson.coordinates.length >= 2);
                    const trace = selectedTrace && selectedTrace.geojson.coordinates.length >= 2 
                      ? selectedTrace 
                      : validTraces[0];
                    
                    const { data: traceMarkers } = await supabase
                      .from('route_markers')
                      .select('*')
                      .eq('trace_id', trace.id)
                      .order('created_at', { ascending: true });
                    
                    setGuidanceMarkers((traceMarkers || []) as RouteMarker[]);
                    setGuidanceTrace(trace);
                  }}
                >
                  <Compass className="w-4 h-4" />
                  Lancer le Guidage
                </Button>
              </div>
            </div>
          );
        })()}

          <CardContent className="space-y-4">
            {/* Mode selector */}
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
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
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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

              {isRecording && !departureMarked && (
                <Button
                  onClick={async () => {
                    await addMarkerAtLastCoord('Point de départ');
                    setDepartureMarked(true);
                  }}
                  variant="outline"
                  className={cn(
                    "gap-2",
                    lastPosition 
                      ? "border-green-500 text-green-600 hover:bg-green-50" 
                      : "border-muted text-muted-foreground"
                  )}
                  disabled={!lastPosition}
                >
                  <Flag className="w-4 h-4" />
                  {lastPosition ? "Marquer départ" : "GPS en attente..."}
                </Button>
              )}

              {isRecording && departureMarked && (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="gap-1 border-green-500 text-green-600 py-1.5 px-3">
                    <Check className="w-3 h-3" />
                    Départ marqué
                  </Badge>
                  <Button
                    onClick={() => addMarkerAtLastCoord('Nouveau point de départ')}
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    disabled={!lastPosition}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    Nouveau départ
                  </Button>
                </div>
              )}

              {isRecording && (
                <Button
                  onClick={handleQuickMarkerOpen}
                  variant="secondary"
                  size="sm"
                  className="gap-1.5 text-xs sm:text-sm"
                  disabled={!lastPosition || quickMarkerOpen}
                >
                  <Zap className="w-4 h-4" />
                  Marqueur rapide
                </Button>
              )}
            </div>
            
            {/* GPS quality indicator */}
            {isRecording && lastPosition && (
              <div className="flex items-center gap-2 text-sm">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  (lastPosition.accuracy || 0) <= 20 ? "bg-green-500" :
                  (lastPosition.accuracy || 0) <= 40 ? "bg-yellow-500" : "bg-red-500"
                )} />
                <span className="text-muted-foreground">
                  GPS: {lastPosition.accuracy?.toFixed(0) || '?'}m
                </span>
                {(lastPosition.accuracy || 0) > 40 && (
                  <span className="text-amber-600 text-xs">(faible précision)</span>
                )}
              </div>
            )}

            {isRecording && !lastPosition && (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertTriangle className="w-4 h-4" />
                Recherche GPS en cours...
              </div>
            )}

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
                    
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        ref={quickMarkerFileRef}
                        onChange={handleQuickMarkerPhotoUpload}
                        className="hidden"
                      />
                      <input
                        type="file"
                        accept="image/*"
                        ref={quickMarkerFileBrowseRef}
                        onChange={handleQuickMarkerPhotoUpload}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => quickMarkerFileRef.current?.click()}
                        disabled={isUploading || isSavingQuickMarker}
                        className="gap-2"
                      >
                        <Camera className="w-4 h-4" />
                        {isUploading ? 'Upload...' : '📷 Photo'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => quickMarkerFileBrowseRef.current?.click()}
                        disabled={isUploading || isSavingQuickMarker}
                        className="gap-2"
                      >
                        <Upload className="w-4 h-4" />
                        📁 Fichier
                      </Button>

                      {/* Voice recording button */}
                      {voiceRecorder.isRecording ? (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={voiceRecorder.stopRecording}
                          className="gap-2 animate-pulse"
                        >
                          <MicOff className="w-4 h-4" />
                          {voiceRecorder.duration}s — Stop
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={voiceRecorder.startRecording}
                          disabled={isUploading || isSavingQuickMarker}
                          className="gap-2"
                        >
                          <Mic className="w-4 h-4" />
                          🎤 Note vocale
                        </Button>
                      )}
                    </div>

                    {/* Preview row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {quickMarkerPhotos.map((url, i) => (
                        <div key={i} className="relative">
                          <img 
                            src={url} 
                            alt={`Preview ${i + 1}`} 
                            className="h-10 w-10 object-cover rounded border"
                          />
                          <button
                            type="button"
                            className="absolute -top-1 -right-1 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center text-xs"
                            onClick={() => setQuickMarkerPhotos(prev => prev.filter((_, j) => j !== i))}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      {quickMarkerAudioUrl && (
                        <div className="flex items-center gap-1 text-xs text-green-600">
                          <Volume2 className="w-3 h-3" />
                          Audio enregistré
                        </div>
                      )}
                    </div>
                    
                    {/* Valider */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleQuickMarkerSave()}
                        disabled={isSavingQuickMarker || isUploading}
                        className="gap-2"
                      >
                        <Check className="w-4 h-4" />
                        {quickMarkerPhotos.length > 0 ? `Valider (${quickMarkerPhotos.length} photo${quickMarkerPhotos.length > 1 ? 's' : ''})` : 'Valider sans photo'}
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
                  💾 Sauvegarde auto: ON (15s) • 🔒 Écran actif
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
                        {!isLibraryMode && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary hover:text-primary"
                            title="Guidage"
                            onClick={async (e) => {
                              e.stopPropagation();
                              const { data: traceMarkers } = await supabase
                                .from('route_markers')
                                .select('*')
                                .eq('trace_id', trace.id)
                                .order('created_at', { ascending: true });
                              setGuidanceMarkers((traceMarkers || []) as RouteMarker[]);
                              setGuidanceTrace(trace);
                            }}
                          >
                            <Compass className="w-4 h-4" />
                          </Button>
                        )}
                        {!isLibraryMode && (
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
                        )}
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
                    {selectedForPromotion.size > 0 && (
                      <Button
                        variant="default"
                        size="sm"
                        className="gap-2"
                        disabled={isPromoting}
                        onClick={async () => {
                          setIsPromoting(true);
                          let successCount = 0;
                          let errorCount = 0;
                          for (const mid of Array.from(selectedForPromotion)) {
                            try {
                              const { error } = await supabase.functions.invoke('promote-marker-to-library', {
                                body: { marker_id: mid },
                              });
                              if (error) throw error;
                              successCount++;
                            } catch {
                              errorCount++;
                            }
                          }
                          setIsPromoting(false);
                          setSelectedForPromotion(new Set());
                          // Refresh markers
                          markersQuery.refetch();
                          if (successCount > 0) {
                            toast({ title: `${successCount} POI ajoutés à la bibliothèque` });
                          }
                          if (errorCount > 0) {
                            toast({ title: `${errorCount} erreur(s)`, variant: 'destructive' });
                          }
                        }}
                      >
                        <Library className="w-3 h-3" />
                        {isPromoting ? 'Envoi...' : `Envoyer vers bibliothèque (${selectedForPromotion.size})`}
                      </Button>
                    )}
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
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setShowReport(true)}
                      disabled={!selectedTraceId || !selectedTrace || selectedTrace.geojson.coordinates.length < 2}
                    >
                      📊 Rapport
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      disabled={!!analyzingMarkerId}
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerAnalyzeAll();
                      }}
                    >
                      🧠 {analyzingMarkerId ? 'Analyse...' : 'Analyser tous'}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  {markers.map((marker, idx) => (
                    <div key={marker.id} className="space-y-0">
                      <div 
                        className="flex items-start gap-2 p-2 rounded bg-muted/30 text-sm cursor-pointer hover:bg-muted/60 transition-colors"
                        onClick={() => setDetailMarkerId(marker.id)}
                      >
                        <Checkbox
                          checked={selectedForPromotion.has(marker.id) || marker.promoted}
                          disabled={marker.promoted}
                          onClick={(e) => e.stopPropagation()}
                          onCheckedChange={(checked) => {
                            setSelectedForPromotion(prev => {
                              const next = new Set(prev);
                              if (checked) next.add(marker.id);
                              else next.delete(marker.id);
                              return next;
                            });
                          }}
                          className="mt-0.5 shrink-0"
                        />
                        <Badge variant="outline" className="shrink-0">{idx + 1}</Badge>
                        {marker.promoted && (
                          <Badge variant="secondary" className="shrink-0 text-xs">Bibliothèque</Badge>
                        )}
                        {markerAnalyses[marker.id] && (
                          <Badge variant="default" className="shrink-0 text-xs">🧠 Analysé</Badge>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">
                            {marker.lat.toFixed(5)}, {marker.lng.toFixed(5)}
                          </p>
                          {marker.note && <p className="truncate">{marker.note}</p>}
                          <div className="flex items-center gap-2 mt-1">
                            {marker.photo_url && (
                              <img 
                                src={marker.photo_url} 
                                alt="Marker" 
                                className="h-12 w-12 object-cover rounded cursor-pointer hover:ring-2 hover:ring-primary transition-shadow"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const photosWithIndex = markers
                                    .map((m, i) => ({ m, i }))
                                    .filter(({ m }) => m.photo_url);
                                  const photoIdx = photosWithIndex.findIndex(({ i }) => i === idx);
                                  if (photoIdx >= 0) {
                                    setLightboxIndex(photoIdx);
                                    setLightboxOpen(true);
                                  }
                                }}
                              />
                            )}
                            {marker.audio_url && (
                              <audio controls className="h-8 max-w-[180px]" onClick={(e) => e.stopPropagation()}>
                                <source src={marker.audio_url} type="audio/webm" />
                              </audio>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Analyser avec l'IA"
                            disabled={analyzingMarkerId === marker.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerMarkerAnalysis(marker);
                            }}
                          >
                            {analyzingMarkerId === marker.id ? (
                              <span className="animate-spin text-xs">⏳</span>
                            ) : (
                              <span className="text-xs">🧠</span>
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Supprimer ce marqueur"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMarkerToDelete({ id: marker.id, traceId: marker.trace_id });
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* AI Analysis Panel */}
                      {markerAnalyses[marker.id] && expandedAnalysisId === marker.id && (() => {
                        const a = markerAnalyses[marker.id];
                        return (
                          <div className="ml-6 p-3 rounded-b-md border border-t-0 border-primary/20 bg-primary/5 text-sm space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-primary">🧠 Compte-rendu IA</p>
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setExpandedAnalysisId(null)}>
                                <X className="w-3 h-3" />
                              </Button>
                            </div>

                            {a.location_guess && (
                              <p><span className="font-medium">📍 Lieu :</span> {a.location_guess}</p>
                            )}
                            {a.category && (
                              <p><span className="font-medium">📂 Catégorie :</span> {a.category}{a.sub_category ? ` / ${a.sub_category}` : ''}</p>
                            )}
                            {a.tags?.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {a.tags.map((t: string) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
                              </div>
                            )}
                            {a.historical_anecdote && (
                              <div>
                                <p className="font-medium">🏛️ Anecdote :</p>
                                <p className="text-muted-foreground">{a.historical_anecdote}</p>
                              </div>
                            )}
                            {a.guide_narration?.fr && (
                              <div>
                                <p className="font-medium">📖 Guide :</p>
                                <p className="text-muted-foreground">{a.guide_narration.fr}</p>
                              </div>
                            )}
                            {a.nearby_restaurants?.length > 0 && (
                              <div>
                                <p className="font-medium">🍽️ Restaurants :</p>
                                <ul className="space-y-2 text-muted-foreground">
                                  {a.nearby_restaurants.map((r: any, i: number) => (
                                    <li key={i} className="space-y-1">
                                      <div className="flex flex-wrap items-center gap-1">
                                        <span className="font-medium text-foreground">{r.name}</span>
                                        <span>— {r.specialty} ({r.price_range})</span>
                                        {r.distance_hint && <span className="text-xs">📍 {r.distance_hint}</span>}
                                      </div>
                                      <div className="flex flex-wrap gap-1 ml-2">
                                        {r.menu_url && (
                                          <a href={r.menu_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs" onClick={e => e.stopPropagation()}>🍽️ Carte</a>
                                        )}
                                        {r.google_maps_query && (
                                          <a href={`https://www.google.com/maps/search/${encodeURIComponent(r.google_maps_query)}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs" onClick={e => e.stopPropagation()}>📍 Maps</a>
                                        )}
                                        {r.instagram_handle && (
                                          <a href={`https://instagram.com/${r.instagram_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-pink-500 hover:underline text-xs" onClick={e => e.stopPropagation()}>📸 {r.instagram_handle}</a>
                                        )}
                                        {r.website_url && (
                                          <a href={r.website_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs" onClick={e => e.stopPropagation()}>🌐 Site</a>
                                        )}
                                      </div>
                                      {r.google_reviews?.length > 0 && (
                                        <div className="ml-2 space-y-0.5">
                                          <p className="text-xs font-medium text-foreground">📝 Avis Google :</p>
                                          {r.google_reviews.slice(0, 5).map((rev: any, j: number) => (
                                            <p key={j} className="text-xs text-muted-foreground">
                                              {"⭐".repeat(Math.round(rev.rating))} <span className="italic">"{rev.text}"</span> — {rev.author}
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {a.nearby_pois?.length > 0 && (
                              <div>
                                <p className="font-medium">🏛️ Points d'intérêt :</p>
                                <ul className="space-y-2 text-muted-foreground">
                                  {a.nearby_pois.map((poi: any, i: number) => (
                                    <li key={i} className="space-y-1">
                                      <div className="flex flex-wrap items-center gap-1">
                                        <span className="font-medium text-foreground">{poi.name}</span>
                                        <Badge variant="outline" className="text-xs">{poi.type}</Badge>
                                        <span className="text-xs">— {poi.description_fr}</span>
                                        {poi.distance_hint && <span className="text-xs">📍 {poi.distance_hint}</span>}
                                      </div>
                                      <div className="flex flex-wrap gap-1 ml-2">
                                        {poi.ticket_url && (
                                          <a href={poi.ticket_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs font-medium" onClick={e => e.stopPropagation()}>🎫 Billets</a>
                                        )}
                                        {poi.ticket_price && (
                                          <span className="text-xs font-medium">💰 {poi.ticket_price}</span>
                                        )}
                                        {poi.opening_hours && (
                                          <span className="text-xs">🕐 {poi.opening_hours}</span>
                                        )}
                                        {poi.google_maps_query && (
                                          <a href={`https://www.google.com/maps/search/${encodeURIComponent(poi.google_maps_query)}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs" onClick={e => e.stopPropagation()}>📍 Maps</a>
                                        )}
                                        {poi.instagram_handle && (
                                          <a href={`https://instagram.com/${poi.instagram_handle.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="text-pink-500 hover:underline text-xs" onClick={e => e.stopPropagation()}>📸 {poi.instagram_handle}</a>
                                        )}
                                        {poi.website_url && (
                                          <a href={poi.website_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-xs" onClick={e => e.stopPropagation()}>🌐 Site</a>
                                        )}
                                      </div>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {a.instagram_spot && a.instagram_spot.score > 0 && (
                              <div>
                                <p className="font-medium">📸 Instagram ({a.instagram_spot.score}/5) :</p>
                                <p className="text-muted-foreground">
                                  {a.instagram_spot.best_angle && <>Angle : {a.instagram_spot.best_angle}<br/></>}
                                  {a.instagram_spot.best_time && <>Heure : {a.instagram_spot.best_time}<br/></>}
                                  {a.instagram_spot.hashtags?.length > 0 && <span>{a.instagram_spot.hashtags.join(' ')}</span>}
                                </p>
                                {a.instagram_spot.instagram_examples?.length > 0 && (
                                  <div className="mt-1">
                                    <p className="text-xs font-medium">Exemples de posts :</p>
                                    <ul className="list-disc list-inside text-xs text-muted-foreground">
                                      {a.instagram_spot.instagram_examples.map((ex: string, i: number) => (
                                        <li key={i}>{ex}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {a.instagram_spot.instagram_example_posts?.length > 0 && (
                                  <div className="mt-1">
                                    <p className="text-xs font-medium">📷 Posts Instagram réels :</p>
                                    <ul className="space-y-1 text-xs text-muted-foreground">
                                      {a.instagram_spot.instagram_example_posts.map((post: any, i: number) => (
                                        <li key={i} className="flex flex-wrap items-center gap-1">
                                          {post.url ? (
                                            <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-pink-500 hover:underline" onClick={e => e.stopPropagation()}>
                                              📸 {post.description}
                                            </a>
                                          ) : (
                                            <span>{post.description}</span>
                                          )}
                                          {post.estimated_likes && <span className="text-muted-foreground/60">❤️ {post.estimated_likes}</span>}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                            {a.practical_tips && (
                              <div>
                                <p className="font-medium">💡 Conseils :</p>
                                <p className="text-muted-foreground">
                                  {a.practical_tips.best_time && <>Horaire : {a.practical_tips.best_time}<br/></>}
                                  {a.practical_tips.photo_tip && <>Photo : {a.practical_tips.photo_tip}<br/></>}
                                  {a.practical_tips.safety_note && <>Sécurité : {a.practical_tips.safety_note}</>}
                                </p>
                              </div>
                            )}
                            {a.audio_transcript && (
                              <div>
                                <p className="font-medium">🎙️ Transcription :</p>
                                <p className="text-muted-foreground">{a.audio_transcript}</p>
                              </div>
                            )}
                            {a.riddles?.length > 0 && (
                              <div>
                                <p className="font-medium">🧩 Énigmes :</p>
                                {a.riddles.map((r: any, i: number) => (
                                  <p key={i} className="text-muted-foreground">• [{r.type}] {r.question}</p>
                                ))}
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                              <Button
                                size="sm"
                                className="gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApproveMarkerAnalysis(marker.id);
                                }}
                              >
                                <Check className="w-3 h-3" />
                                Approuver
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="gap-1"
                                disabled={marker.promoted}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApproveAndPromote(marker.id);
                                }}
                              >
                                ✅ Approuver + Bibliothèque
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCorrectMarkerAnalysis(marker.id);
                                }}
                              >
                                ✏️ Corriger
                              </Button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Show "Analysé" clickable badge to re-expand */}
                      {markerAnalyses[marker.id] && expandedAnalysisId !== marker.id && (
                        <div className="ml-6 px-3 py-1">
                          <button
                            className="text-xs text-primary hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedAnalysisId(marker.id);
                            }}
                          >
                            🧠 Voir le compte-rendu IA
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Manual Marker Entry Section */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  Saisie manuelle
                </Label>
                <Button
                  variant={manualFormOpen ? "secondary" : "outline"}
                  size="sm"
                  className="gap-2"
                  onClick={() => setManualFormOpen(!manualFormOpen)}
                >
                  {manualFormOpen ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  {manualFormOpen ? 'Fermer' : 'Ajouter un point'}
                </Button>
              </div>
              
              {manualFormOpen && (
                <div className="p-3 rounded-md border border-primary/30 bg-primary/5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Latitude</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        min={-90}
                        max={90}
                        placeholder="ex: 33.589886"
                        value={manualLat}
                        onChange={(e) => setManualLat(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Longitude</Label>
                      <Input
                        type="number"
                        step="0.000001"
                        min={-180}
                        max={180}
                        placeholder="ex: -7.603869"
                        value={manualLng}
                        onChange={(e) => setManualLng(e.target.value)}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-xs">Note (optionnel)</Label>
                    <Textarea
                      placeholder="Description du point..."
                      value={manualNote}
                      onChange={(e) => setManualNote(e.target.value)}
                      className="min-h-[50px] text-sm"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      accept="image/*"
                      ref={manualPhotoRef}
                      onChange={handleManualPhotoUpload}
                      className="hidden"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => manualPhotoRef.current?.click()}
                      disabled={isUploading || isSavingManual}
                      className="gap-2"
                    >
                      <Camera className="w-4 h-4" />
                      {isUploading ? 'Upload...' : '📸 Photo (auto-save)'}
                    </Button>
                    {manualPhotoUrl && (
                      <img src={manualPhotoUrl} alt="Preview" className="h-10 w-10 object-cover rounded border" />
                    )}
                  </div>

                  {manualSaved ? (
                    <div className="flex items-center justify-center gap-2 py-2 text-green-600">
                      <Check className="w-5 h-5" />
                      <span className="text-sm font-medium">Marqueur ajouté !</span>
                    </div>
                  ) : (
                    <Button
                      onClick={handleAddManualMarker}
                      disabled={isSavingManual || !manualLat || !manualLng}
                      className="gap-2 w-full"
                    >
                      <Plus className="w-4 h-4" />
                      {isSavingManual ? 'Ajout...' : 'Ajouter'}
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Photo Gallery */}
            {selectedTrace && (() => {
              const photosForGallery: LightboxPhoto[] = markers
                .filter(m => m.photo_url)
                .map(m => ({
                  url: m.photo_url!,
                  note: m.note,
                  lat: m.lat,
                  lng: m.lng,
                }));
              
              if (photosForGallery.length === 0) return null;
              
              return (
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Galerie Photos ({photosForGallery.length})
                  </Label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {photosForGallery.map((photo, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-square rounded-lg overflow-hidden cursor-pointer group border hover:ring-2 hover:ring-primary transition-all"
                        onClick={() => {
                          setLightboxIndex(idx);
                          setLightboxOpen(true);
                        }}
                      >
                        <img
                          src={photo.url}
                          alt={photo.note || `Photo ${idx + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                          <p className="text-[10px] text-white/80 flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5" />
                            {photo.lat?.toFixed(4)}, {photo.lng?.toFixed(4)}
                          </p>
                          {photo.note && (
                            <p className="text-[10px] text-white truncate">{photo.note}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Lightbox */}
            <PhotoLightbox
              photos={markers
                .filter(m => m.photo_url)
                .map(m => ({
                  url: m.photo_url!,
                  note: m.note,
                  lat: m.lat,
                  lng: m.lng,
                }))}
              initialIndex={lightboxIndex}
              open={lightboxOpen}
              onClose={() => setLightboxOpen(false)}
            />

            {/* Interactive Leaflet map */}
            {(selectedTrace && selectedTrace.geojson.coordinates.length > 0) || (isRecording && coords.length > 0) ? (
              <RouteReconMap
                trace={selectedTrace || null}
                markers={markers}
                liveCoords={isRecording ? coords : undefined}
                lastPosition={isRecording ? lastPosition : undefined}
                className="h-72 w-full rounded-md overflow-hidden border"
              />
            ) : null}
          </CardContent>
        </Card>

      {/* Route details - hidden in library mode */}
      {!isLibraryMode && (
        <>
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
                value={localSegments}
                onChange={(e) => handleDebouncedArrayChange('segments', e.target.value, setLocalSegments)}
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
                value={localDangerPoints}
                onChange={(e) => handleDebouncedArrayChange('danger_points', e.target.value, setLocalDangerPoints)}
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
                value={localMandatoryStops}
                onChange={(e) => handleDebouncedArrayChange('mandatory_stops', e.target.value, setLocalMandatoryStops)}
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
                value={localSafetyBrief}
                onChange={(e) => handleDebouncedArrayChange('safety_brief', e.target.value, setLocalSafetyBrief)}
                placeholder="Ex: Équipement obligatoire: casque, gilet&#10;Ne pas dépasser 30km/h en zone urbaine&#10;Signaler tout incident au 06..."
                rows={5}
              />
            </div>
          </OptionMatrix>
        </>
      )}

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
      
      {/* Guidance View with ErrorBoundary */}
      {guidanceTrace && createPortal(
        <GuidanceErrorBoundary
          onClose={() => {
            setGuidanceTrace(null);
            setGuidanceMarkers([]);
          }}
        >
          <RouteGuidanceView
            trace={guidanceTrace}
            markers={guidanceMarkers}
            onClose={() => {
              setGuidanceTrace(null);
              setGuidanceMarkers([]);
            }}
          />
        </GuidanceErrorBoundary>,
        document.body
      )}
      
      {/* Interactive Report Dialog */}
      {selectedTrace && (
        <InteractiveReportViewer
          open={showReport}
          onOpenChange={setShowReport}
          trace={selectedTrace}
          markers={markers}
          projectName={project?.hotel_name || 'Parcours'}
          projectCity={project?.city}
          questConfig={project?.quest_config as Record<string, unknown>}
          poisCount={markers.length}
        />
      )}
      {/* Delete Marker Confirmation */}
      <AlertDialog open={!!markerToDelete} onOpenChange={(open) => { if (!open) setMarkerToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce marqueur ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Le marqueur et sa photo seront supprimés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (markerToDelete) {
                  await deleteMarker.mutateAsync({ markerId: markerToDelete.id, traceId: markerToDelete.traceId });
                  setMarkerToDelete(null);
                }
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Marker Dialog (kept for programmatic use) */}
      <Dialog open={!!editingMarker} onOpenChange={(open) => { if (!open) setEditingMarker(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le marqueur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Latitude</Label>
                <Input
                  type="number"
                  step="0.000001"
                  min={-90}
                  max={90}
                  value={editLat}
                  onChange={(e) => setEditLat(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-xs">Longitude</Label>
                <Input
                  type="number"
                  step="0.000001"
                  min={-180}
                  max={180}
                  value={editLng}
                  onChange={(e) => setEditLng(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label className="text-xs">Note</Label>
              <Textarea
                placeholder="Description du point..."
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                className="min-h-[60px] text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*"
                ref={editPhotoRef}
                onChange={(e) => handlePhotoUpload(e, setEditPhotoUrl)}
                className="hidden"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => editPhotoRef.current?.click()}
                disabled={isUploading}
                className="gap-2"
              >
                <Camera className="w-4 h-4" />
                {isUploading ? 'Upload...' : editPhotoUrl ? 'Changer photo' : 'Ajouter photo'}
              </Button>
              {editPhotoUrl && (
                <div className="relative">
                  <img src={editPhotoUrl} alt="Preview" className="h-12 w-12 object-cover rounded border" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground"
                    onClick={() => setEditPhotoUrl('')}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>
            {editAudioUrl && (
              <div className="space-y-1">
                <Label className="text-xs">Note vocale</Label>
                <audio controls className="w-full h-8">
                  <source src={editAudioUrl} type="audio/webm" />
                </audio>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (editingMarker) {
                  setMarkerToDelete({ id: editingMarker.id, traceId: editingMarker.trace_id });
                  setEditingMarker(null);
                }
              }}
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Supprimer
            </Button>
            <div className="flex-1" />
            <Button variant="outline" onClick={() => setEditingMarker(null)}>
              Annuler
            </Button>
            <Button onClick={handleSaveEditMarker} disabled={isSavingEdit}>
              {isSavingEdit ? 'Enregistrement...' : 'Enregistrer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Marker Detail Sheet (fullscreen) */}
      <MarkerDetailSheet
        marker={markers.find(m => m.id === detailMarkerId) || null}
        analysis={detailMarkerId ? markerAnalyses[detailMarkerId] || null : null}
        allMarkers={markers}
        projectId={projectId}
        open={!!detailMarkerId}
        onClose={() => setDetailMarkerId(null)}
        onSave={async (data) => {
          if (!detailMarkerId) return;
          const m = markers.find(mk => mk.id === detailMarkerId);
          if (!m) return;
          await updateMarker.mutateAsync({
            markerId: m.id,
            traceId: m.trace_id,
            lat: data.lat,
            lng: data.lng,
            note: data.note,
            photoUrl: data.photoUrl,
            audioUrl: data.audioUrl,
          });
        }}
        onDelete={(markerId, traceId) => {
          setMarkerToDelete({ id: markerId, traceId });
          setDetailMarkerId(null);
        }}
        onApproveAndPromote={async (markerId) => {
          await handleApproveAndPromote(markerId);
          setDetailMarkerId(null);
        }}
        onAnalysisUpdate={(markerId, analysis) => {
          setMarkerAnalyses(prev => ({ ...prev, [markerId]: analysis }));
        }}
      />
    </div>
  );
}
