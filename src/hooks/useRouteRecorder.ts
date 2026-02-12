import type { LineString, FeatureCollection, Feature, Point } from 'geojson';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type RecordingMode = 'walking' | 'scooter';
export type RecordingStatus = 'idle' | 'recording' | 'error';

// Speed thresholds in m/s for filtering unrealistic jumps
const SPEED_THRESHOLDS: Record<RecordingMode, number> = {
  walking: 12, // ~43 km/h max for walking/running
  scooter: 25, // ~90 km/h max for scooter
};

// Filtering constants
const MAX_ACCURACY_METERS = 40;
const MIN_DISTANCE_METERS = 10;
const MIN_ELAPSED_SECONDS = 5;

export interface RouteCoord {
  lat: number;
  lng: number;
  timestamp: number;
  accuracy?: number;
}

export interface RouteMarker {
  id: string;
  trace_id: string;
  lat: number;
  lng: number;
  note: string | null;
  photo_url: string | null;
  created_at: string;
}

export interface RouteTrace {
  id: string;
  project_id: string;
  name: string | null;
  geojson: LineString;
  started_at: string | null;
  ended_at: string | null;
  distance_meters: number | null;
  created_at: string;
}

interface RecordingState {
  status: RecordingStatus;
  errorMessage: string | null;
  startTime: number | null;
  coords: RouteCoord[];
  currentTraceId: string | null;
  mode: RecordingMode;
}

// Calculate distance between two points using Haversine formula
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Calculate total distance from coords array
function calculateTotalDistance(coords: RouteCoord[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineDistance(
      coords[i - 1].lat, coords[i - 1].lng,
      coords[i].lat, coords[i].lng
    );
  }
  return total;
}

// Autosave interval in ms
const AUTOSAVE_INTERVAL_MS = 15000;

export function useRouteRecorder(projectId: string | undefined, mode: RecordingMode = 'walking') {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const watchIdRef = useRef<number | null>(null);
  const lastKeptPointRef = useRef<RouteCoord | null>(null);
  const modeRef = useRef<RecordingMode>(mode);
  const autosaveIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSavedCountRef = useRef<number>(0);
  
  // Keep mode ref in sync
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  
  const [state, setState] = useState<RecordingState>({
    status: 'idle',
    errorMessage: null,
    startTime: null,
    coords: [],
    currentTraceId: null,
    mode,
  });

  // Fetch existing traces for project
  const tracesQuery = useQuery({
    queryKey: ['route-traces', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('route_traces')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map(d => ({ ...d, geojson: d.geojson as unknown as LineString })) as RouteTrace[];
    },
    enabled: !!projectId,
  });

  // Fetch markers for a specific trace
  const useTraceMarkers = (traceId: string | null) => {
    return useQuery({
      queryKey: ['route-markers', traceId],
      queryFn: async () => {
        if (!traceId) return [];
        const { data, error } = await supabase
          .from('route_markers')
          .select('*')
          .eq('trace_id', traceId)
          .order('created_at', { ascending: true });
        if (error) throw error;
        return (data || []) as RouteMarker[];
      },
      enabled: !!traceId,
    });
  };

  // Create new trace
  const createTrace = useMutation({
    mutationFn: async () => {
      if (!projectId) throw new Error('No project ID');
      const { data, error } = await supabase
        .from('route_traces')
        .insert({
          project_id: projectId,
          started_at: new Date().toISOString(),
          geojson: { type: 'LineString', coordinates: [] },
        })
        .select()
        .single();
      if (error) throw error;
      return { ...data, geojson: data.geojson as unknown as LineString } as RouteTrace;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-traces', projectId] });
    },
  });

  // Update trace with new coords
  const updateTrace = useMutation({
    mutationFn: async ({ traceId, coords, ended }: { traceId: string; coords: RouteCoord[]; ended?: boolean }) => {
      const geojson: LineString = {
        type: 'LineString',
        coordinates: coords.map(c => [c.lng, c.lat]),
      };
      const distance = calculateTotalDistance(coords);
      
      const updates: Record<string, unknown> = {
        geojson,
        distance_meters: distance,
      };
      if (ended) {
        updates.ended_at = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from('route_traces')
        .update(updates)
        .eq('id', traceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-traces', projectId] });
    },
  });

  // Add marker
  const addMarker = useMutation({
    mutationFn: async ({ traceId, lat, lng, note, photoUrl }: { 
      traceId: string; 
      lat: number; 
      lng: number; 
      note?: string; 
      photoUrl?: string;
    }) => {
      const { data, error } = await supabase
        .from('route_markers')
        .insert({
          trace_id: traceId,
          lat,
          lng,
          note: note || null,
          photo_url: photoUrl || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as RouteMarker;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['route-markers', variables.traceId] });
      toast({ title: 'Marqueur ajouté' });
    },
  });

  // Delete trace
  const deleteTrace = useMutation({
    mutationFn: async (traceId: string) => {
      const { error } = await supabase
        .from('route_traces')
        .delete()
        .eq('id', traceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['route-traces', projectId] });
      toast({ title: 'Trace supprimée' });
    },
  });

  // Autosave function - updates DB with current coords
  const performAutosave = useCallback(async (traceId: string, coords: RouteCoord[]) => {
    // Only save if we have new coords
    if (coords.length <= lastSavedCountRef.current) {
      return;
    }
    
    const geojson = {
      type: 'LineString' as const,
      coordinates: coords.map(c => [c.lng, c.lat]),
    };
    const distance = calculateTotalDistance(coords);
    
    try {
      const { error } = await supabase
        .from('route_traces')
        .update({
          geojson: JSON.parse(JSON.stringify(geojson)),
          distance_meters: distance,
        })
        .eq('id', traceId);
      
      if (error) throw error;
      
      lastSavedCountRef.current = coords.length;
      console.log(`Autosave: ${coords.length} points saved`);
    } catch (err) {
      console.error('Autosave failed:', err);
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    // Check geolocation support
    if (!('geolocation' in navigator)) {
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: 'Géolocalisation non disponible sur cet appareil',
      }));
      return;
    }

    try {
      const trace = await createTrace.mutateAsync();
      
      // Reset refs
      lastKeptPointRef.current = null;
      lastSavedCountRef.current = 0;
      
      setState({
        status: 'recording',
        errorMessage: null,
        startTime: Date.now(),
        coords: [],
        currentTraceId: trace.id,
        mode: modeRef.current,
      });

      // Start autosave interval
      autosaveIntervalRef.current = setInterval(() => {
        setState(currentState => {
          if (currentState.status === 'recording' && currentState.currentTraceId && currentState.coords.length > 0) {
            performAutosave(currentState.currentTraceId, currentState.coords);
          }
          return currentState;
        });
      }, AUTOSAVE_INTERVAL_MS);

      // Start watching position with filtering
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          const accuracy = position.coords.accuracy;
          const newCoord: RouteCoord = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            timestamp: position.timestamp,
            accuracy,
          };
          
          const lastKept = lastKeptPointRef.current;
          const isFirstPoint = lastKept === null;
          
          // Filter 1: For first point, accept even with poor accuracy (for departure marker)
          // For subsequent points, reject poor accuracy
          if (!isFirstPoint && accuracy > MAX_ACCURACY_METERS) {
            console.log(`GPS filtered: accuracy ${accuracy.toFixed(1)}m > ${MAX_ACCURACY_METERS}m`);
            return;
          }
          
          // Warn if first point has poor accuracy
          if (isFirstPoint && accuracy > MAX_ACCURACY_METERS) {
            console.warn(`First GPS point accepted despite poor accuracy: ${accuracy.toFixed(1)}m`);
          }
          
          // Always keep first point
          if (!lastKept) {
            lastKeptPointRef.current = newCoord;
            setState(prev => ({
              ...prev,
              coords: [newCoord],
            }));
            return;
          }
          
          // Filter 2: Check for unrealistic speed
          const distanceFromLast = haversineDistance(
            lastKept.lat, lastKept.lng,
            newCoord.lat, newCoord.lng
          );
          const elapsedSec = (newCoord.timestamp - lastKept.timestamp) / 1000;
          
          if (elapsedSec > 0) {
            const speed = distanceFromLast / elapsedSec;
            const threshold = SPEED_THRESHOLDS[modeRef.current];
            if (speed > threshold) {
              console.log(`GPS filtered: speed ${speed.toFixed(1)} m/s > ${threshold} m/s`);
              return;
            }
          }
          
          // Sampling: Only add if moved enough OR enough time elapsed
          const shouldKeep = distanceFromLast >= MIN_DISTANCE_METERS || elapsedSec >= MIN_ELAPSED_SECONDS;
          
          if (shouldKeep) {
            lastKeptPointRef.current = newCoord;
            setState(prev => ({
              ...prev,
              coords: [...prev.coords, newCoord],
            }));
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
          
          // Timeout errors are non-fatal: the watchPosition will keep trying
          // Only stop recording on permission denied or position unavailable
          if (error.code === error.TIMEOUT) {
            console.warn('GPS timeout - watchPosition will retry automatically');
            // Don't change state, let it keep trying
            return;
          }
          
          // Clear watch on fatal errors only
          if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
            watchIdRef.current = null;
          }
          
          let message: string;
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Permission GPS refusée. Autorisez l\'accès dans les paramètres.';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Position GPS indisponible. Vérifiez que le GPS est activé.';
              break;
            default:
              message = error.message || 'Erreur GPS inconnue';
          }
          
          setState(prev => ({
            ...prev,
            status: 'error',
            errorMessage: message,
          }));
        },
        {
          enableHighAccuracy: true,
          maximumAge: 5000,
          timeout: 30000,
        }
      );

      toast({ title: 'Enregistrement démarré' });
    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: 'Impossible de créer la trace. Vérifiez la connexion.',
      }));
    }
  }, [createTrace, toast]);

  // Stop recording - use ref to get current state to avoid stale closures
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const stopRecording = useCallback(async () => {
    // Clear autosave interval
    if (autosaveIntervalRef.current !== null) {
      clearInterval(autosaveIntervalRef.current);
      autosaveIntervalRef.current = null;
    }
    
    // Always clear watch first
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Get current state from ref to avoid stale closure
    const { currentTraceId, coords } = stateRef.current;
    
    // Ensure last point is included if we have coords
    if (currentTraceId && coords.length > 0) {
      try {
        await updateTrace.mutateAsync({
          traceId: currentTraceId,
          coords: coords,
          ended: true,
        });
      } catch (err) {
        console.error('Failed to save trace on stop:', err);
      }
    }

    // Reset state and refs
    lastKeptPointRef.current = null;
    lastSavedCountRef.current = 0;
    setState({
      status: 'idle',
      errorMessage: null,
      startTime: null,
      coords: [],
      currentTraceId: null,
      mode: modeRef.current,
    });

    toast({ title: 'Enregistrement arrêté' });
  }, [updateTrace, toast]);

  // Retry after error
  const retry = useCallback(() => {
    setState(prev => ({
      ...prev,
      status: 'idle',
      errorMessage: null,
    }));
  }, []);

  // Add marker at last known coord (quick marker)
  const addMarkerAtLastCoord = useCallback(async (note?: string, photoUrl?: string) => {
    const { currentTraceId, coords } = state;
    
    if (!currentTraceId) {
      throw new Error('Aucun enregistrement en cours');
    }
    
    if (coords.length === 0) {
      throw new Error('Aucune position GPS disponible');
    }
    
    const lastCoord = coords[coords.length - 1];
    
    return addMarker.mutateAsync({
      traceId: currentTraceId,
      lat: lastCoord.lat,
      lng: lastCoord.lng,
      note: note || undefined,
      photoUrl: photoUrl || undefined,
    });
  }, [state.currentTraceId, state.coords, addMarker]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (autosaveIntervalRef.current !== null) {
        clearInterval(autosaveIntervalRef.current);
      }
    };
  }, []);

  // Live stats
  const liveStats = {
    duration: state.startTime ? Math.floor((Date.now() - state.startTime) / 1000) : 0,
    distance: calculateTotalDistance(state.coords),
    points: state.coords.length,
  };

  // Get last known position
  const lastPosition = state.coords.length > 0 ? state.coords[state.coords.length - 1] : null;

  return {
    // State
    status: state.status,
    errorMessage: state.errorMessage,
    isRecording: state.status === 'recording',
    currentTraceId: state.currentTraceId,
    coords: state.coords,
    liveStats,
    lastPosition,
    
    // Queries
    traces: tracesQuery.data || [],
    isLoadingTraces: tracesQuery.isLoading,
    useTraceMarkers,
    
    // Actions
    startRecording,
    stopRecording,
    addMarker,
    addMarkerAtLastCoord,
    deleteTrace,
    retry,
  };
}

// Export helper for GeoJSON
export function exportTraceAsGeoJSON(trace: RouteTrace, markers: RouteMarker[]): string {
  const featureCollection: FeatureCollection = {
    type: 'FeatureCollection',
    features: [
      // Main route line
      {
        type: 'Feature',
        properties: {
          type: 'route',
          name: trace.name || 'Route trace',
          started_at: trace.started_at,
          ended_at: trace.ended_at,
          distance_meters: trace.distance_meters,
        },
        geometry: trace.geojson,
      },
      // Markers as points
      ...markers.map(marker => ({
        type: 'Feature' as const,
        properties: {
          type: 'marker',
          note: marker.note,
          photo_url: marker.photo_url,
          created_at: marker.created_at,
        },
        geometry: {
          type: 'Point' as const,
          coordinates: [marker.lng, marker.lat],
        },
      })),
    ],
  };
  
  return JSON.stringify(featureCollection, null, 2);
}

// Helper to escape CSV field values
function escapeCSVField(value: string | null | undefined): string {
  if (value == null) return '';
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape inner quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Export helper for markers CSV
export function buildMarkersCSV(markers: RouteMarker[]): string {
  const header = 'title,note,lng,lat,created_at,photo_url';
  const rows = markers.map((marker, idx) => {
    const title = `Marker ${idx + 1}`;
    return [
      escapeCSVField(title),
      escapeCSVField(marker.note),
      marker.lng,
      marker.lat,
      escapeCSVField(marker.created_at),
      escapeCSVField(marker.photo_url),
    ].join(',');
  });
  return [header, ...rows].join('\n');
}

// Export helper for recon brief markdown
export function buildReconBriefMarkdown(trace: RouteTrace, markers: RouteMarker[], mode: RecordingMode): string {
  const traceName = trace.name || `Trace ${new Date(trace.created_at).toLocaleDateString('fr-FR')}`;
  const modeLabel = mode === 'walking' ? 'Marche' : 'Trottinette';
  const distance = trace.distance_meters ? `${(trace.distance_meters / 1000).toFixed(2)} km` : '—';
  const pointsCount = trace.geojson.coordinates.length;
  
  // Calculate duration if we have start and end
  let duration = '—';
  if (trace.started_at && trace.ended_at) {
    const start = new Date(trace.started_at).getTime();
    const end = new Date(trace.ended_at).getTime();
    const mins = Math.round((end - start) / 60000);
    duration = `${mins} min`;
  }
  
  const date = new Date(trace.created_at).toLocaleDateString('fr-FR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Build markers table
  const tableHeader = '| # | Titre | Note | Coordonnées | Photo |';
  const tableSeparator = '|---|-------|------|-------------|-------|';
  const tableRows = markers.map((marker, idx) => {
    const title = `Marker ${idx + 1}`;
    const note = marker.note?.replace(/\|/g, '\\|').replace(/\n/g, ' ') || '—';
    const coords = `${marker.lat.toFixed(5)}, ${marker.lng.toFixed(5)}`;
    const photo = marker.photo_url ? `[📷](${marker.photo_url})` : '—';
    return `| ${idx + 1} | ${title} | ${note} | ${coords} | ${photo} |`;
  });

  // Build quick list
  const quickList = markers.map((marker, idx) => {
    const note = marker.note || '(sans note)';
    const coords = `${marker.lat.toFixed(5)}, ${marker.lng.toFixed(5)}`;
    const photo = marker.photo_url || '';
    return `- **Marker ${idx + 1}** — ${note} (${coords})${photo ? ` ${photo}` : ''}`;
  });

  return `# ${traceName}

- **Date** : ${date}
- **Mode** : ${modeLabel}
- **Distance** : ${distance}
- **Durée** : ${duration}
- **Points GPS** : ${pointsCount}

## Résumé

_Observations :_


_Risques identifiés :_


_Opportunités :_


## Marqueurs

${markers.length > 0 ? `${tableHeader}\n${tableSeparator}\n${tableRows.join('\n')}` : '_Aucun marqueur enregistré._'}

## Liste rapide (copy/paste)

${quickList.length > 0 ? quickList.join('\n') : '_Aucun marqueur._'}
`;
}
