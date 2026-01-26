import type { LineString, FeatureCollection, Feature, Point } from 'geojson';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type RecordingMode = 'walking' | 'scooter';

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
  isRecording: boolean;
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

export function useRouteRecorder(projectId: string | undefined, mode: RecordingMode = 'walking') {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const watchIdRef = useRef<number | null>(null);
  const lastKeptPointRef = useRef<RouteCoord | null>(null);
  const modeRef = useRef<RecordingMode>(mode);
  
  // Keep mode ref in sync
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  
  const [state, setState] = useState<RecordingState>({
    isRecording: false,
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

  // Start recording
  const startRecording = useCallback(async () => {
    if (!('geolocation' in navigator)) {
      toast({ title: 'Géolocalisation non disponible', variant: 'destructive' });
      return;
    }

    try {
      const trace = await createTrace.mutateAsync();
      
      // Reset last kept point
      lastKeptPointRef.current = null;
      
      setState({
        isRecording: true,
        startTime: Date.now(),
        coords: [],
        currentTraceId: trace.id,
        mode: modeRef.current,
      });

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
          
          // Filter 1: Reject poor accuracy
          if (accuracy > MAX_ACCURACY_METERS) {
            console.log(`GPS filtered: accuracy ${accuracy.toFixed(1)}m > ${MAX_ACCURACY_METERS}m`);
            return;
          }
          
          const lastKept = lastKeptPointRef.current;
          
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
          toast({ title: 'Erreur GPS', description: error.message, variant: 'destructive' });
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 10000,
        }
      );

      toast({ title: 'Enregistrement démarré' });
    } catch (err) {
      toast({ title: 'Erreur', description: 'Impossible de démarrer l\'enregistrement', variant: 'destructive' });
    }
  }, [createTrace, toast]);

  // Stop recording
  const stopRecording = useCallback(async () => {
    // Always clear watch first
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    // Get current state for saving
    const { currentTraceId, coords } = state;
    
    // Ensure last point is included if we have coords
    if (currentTraceId && coords.length > 0) {
      await updateTrace.mutateAsync({
        traceId: currentTraceId,
        coords: coords,
        ended: true,
      });
    }

    // Reset state
    lastKeptPointRef.current = null;
    setState({
      isRecording: false,
      startTime: null,
      coords: [],
      currentTraceId: null,
      mode: modeRef.current,
    });

    toast({ title: 'Enregistrement arrêté' });
  }, [state.currentTraceId, state.coords, updateTrace, toast]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
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
    isRecording: state.isRecording,
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
    deleteTrace,
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
