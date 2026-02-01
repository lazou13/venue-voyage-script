import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, Navigation, AlertTriangle, Footprints, Bike, ChevronUp, ChevronDown, PartyPopper, ArrowRight, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { RouteTrace, RouteMarker } from '@/hooks/useRouteRecorder';
import {
  snapToPolyline,
  computeProgressPolyline,
  inferMarkerKind,
  getMarkerEmoji,
  type MarkerKind,
  type Coord,
} from '@/lib/routeGeometry';

// Color palette
const COLORS = {
  traceTotal: '#CBD5E1',      // Light gray
  traceCompleted: '#22C55E',  // Dynamic green
  traceActive: '#3B82F6',     // Bright blue
  userPosition: '#3B82F6',    // Blue
  userHalo: 'rgba(59, 130, 246, 0.2)',
  danger: '#EF4444',          // Red
  mandatoryStop: '#F97316',   // Orange
  poi: '#8B5CF6',             // Purple
  departure: '#10B981',       // Green
  arrival: '#EC4899',         // Pink
};

// Max accuracy to consider GPS valid
const MAX_ACCURACY_METERS = 40;
// Distance threshold to show "hors trace" warning
const OFF_TRACK_THRESHOLD_METERS = 30;

interface RouteGuidanceViewProps {
  trace: RouteTrace;
  markers: RouteMarker[];
  onClose: () => void;
}

// Get marker color by kind
function getMarkerColor(kind: MarkerKind): string {
  switch (kind) {
    case 'danger': return COLORS.danger;
    case 'mandatory_stop': return COLORS.mandatoryStop;
    case 'departure': return COLORS.departure;
    case 'poi': return COLORS.poi;
    default: return COLORS.poi;
  }
}

// Get friendly label for marker kind
function getMarkerLabel(kind: MarkerKind): string {
  switch (kind) {
    case 'danger': return 'Zone dangereuse';
    case 'mandatory_stop': return 'Arrêt obligatoire';
    case 'departure': return 'Point de départ';
    case 'poi': return 'Point d\'intérêt';
    default: return 'Point';
  }
}

// Custom marker icons with animation support
function createMarkerIcon(kind: MarkerKind, isPulsing: boolean = false): L.DivIcon {
  const emoji = getMarkerEmoji(kind);
  const color = getMarkerColor(kind);
  const pulseClass = isPulsing ? 'animate-pulse' : '';
  
  return L.divIcon({
    html: `
      <div class="relative flex items-center justify-center ${pulseClass}">
        <div class="absolute w-10 h-10 rounded-full opacity-30" style="background: ${color}; animation: ${isPulsing ? 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite' : 'none'}"></div>
        <span style="font-size: 28px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">${emoji}</span>
      </div>
    `,
    className: 'bg-transparent border-0',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

// Unified map controller component - handles bounds and centering safely
function MapController({ 
  coords, 
  userPosition, 
  shouldCenter 
}: { 
  coords: [number, number][]; 
  userPosition: Coord | null; 
  shouldCenter: boolean;
}) {
  const map = useMap();
  const hasFittedBounds = useRef(false);
  
  // Fit bounds on initial mount only
  useEffect(() => {
    if (!map || coords.length === 0 || hasFittedBounds.current) return;
    
    try {
      const latLngs = coords.map(c => [c[1], c[0]] as [number, number]);
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [50, 50] });
      hasFittedBounds.current = true;
    } catch (err) {
      console.warn('MapController: fitBounds error', err);
    }
  }, [map, coords]);
  
  // Center on user when following
  useEffect(() => {
    if (!map || !userPosition || !shouldCenter) return;
    
    try {
      map.setView([userPosition.lat, userPosition.lng], map.getZoom());
    } catch (err) {
      console.warn('MapController: setView error', err);
    }
  }, [map, userPosition, shouldCenter]);
  
  return null;
}

interface MarkerWithKind extends RouteMarker {
  kind: MarkerKind;
  distanceAlongRoute: number;
}

// Toast notification component
function SegmentToast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div className={cn(
      "fixed top-20 left-1/2 -translate-x-1/2 z-[1100] px-4 py-2 bg-white/95 backdrop-blur-sm rounded-full shadow-lg border border-border",
      "flex items-center gap-2 text-sm font-medium transition-all duration-300",
      visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
    )}>
      <ArrowRight className="w-4 h-4 text-primary" />
      {message}
    </div>
  );
}

// Completion celebration overlay
function CompletionOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  if (!visible) return null;
  
  return (
    <div className="fixed inset-0 z-[1200] bg-black/60 backdrop-blur-sm flex items-center justify-center animate-fade-in">
      <div className="bg-white rounded-3xl p-8 mx-4 text-center shadow-2xl animate-scale-in">
        <PartyPopper className="w-16 h-16 mx-auto mb-4 text-yellow-500" />
        <h2 className="text-2xl font-bold mb-2">Parcours terminé 🎉</h2>
        <p className="text-muted-foreground mb-6">Félicitations, vous avez suivi le parcours jusqu'au bout !</p>
        <Button onClick={onClose} size="lg" className="rounded-full px-8">
          Fermer
        </Button>
      </div>
    </div>
  );
}

export function RouteGuidanceView({ trace, markers, onClose }: RouteGuidanceViewProps) {
  const [userPosition, setUserPosition] = useState<Coord | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [followUser, setFollowUser] = useState(true);
  const [mode, setMode] = useState<'walk' | 'scooter'>('walk');
  const [bottomSheetExpanded, setBottomSheetExpanded] = useState(true);
  const [segmentToast, setSegmentToast] = useState<string | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);
  const [lastSegmentIndex, setLastSegmentIndex] = useState<number | null>(null);
  const watchIdRef = useRef<number | null>(null);
  
  const polylineCoords = trace.geojson.coordinates as [number, number][];
  
  // Calculate total distance
  const totalDistance = trace.distance_meters || 0;
  
  // Parse markers with kind and distance along route
  const markersWithKind = useMemo<MarkerWithKind[]>(() => {
    return markers.map(m => {
      const kind = inferMarkerKind(m.note);
      const snap = snapToPolyline({ lat: m.lat, lng: m.lng }, polylineCoords);
      return {
        ...m,
        kind,
        distanceAlongRoute: snap?.progressMetersAlongLine || 0,
      };
    }).sort((a, b) => a.distanceAlongRoute - b.distanceAlongRoute);
  }, [markers, polylineCoords]);
  
  // Find departure and arrival markers
  const departureMarker = markersWithKind.find(m => m.kind === 'departure');
  const arrivalMarker = markersWithKind[markersWithKind.length - 1];
  
  // Snap user to polyline
  const snapResult = useMemo(() => {
    if (!userPosition || polylineCoords.length < 2) return null;
    return snapToPolyline(userPosition, polylineCoords);
  }, [userPosition, polylineCoords]);
  
  // Compute progress polyline
  const progressPolyline = useMemo(() => {
    if (!snapResult) {
      return { completedCoords: [], remainingCoords: polylineCoords };
    }
    return computeProgressPolyline(polylineCoords, snapResult.progressMetersAlongLine);
  }, [polylineCoords, snapResult]);
  
  // Calculate completion percentage
  const completionPercent = useMemo(() => {
    if (!snapResult || totalDistance === 0) return 0;
    return Math.min(100, Math.round((snapResult.progressMetersAlongLine / totalDistance) * 100));
  }, [snapResult, totalDistance]);
  
  // Detect segment changes and show toast
  useEffect(() => {
    if (snapResult && lastSegmentIndex !== null && snapResult.nearestSegmentIndex !== lastSegmentIndex) {
      const segmentNames = ['Nouveau segment', 'Zone de transition', 'Descente rapide', 'Montée légère', 'Zone rocheuse'];
      const randomName = segmentNames[snapResult.nearestSegmentIndex % segmentNames.length];
      setSegmentToast(`➡️ ${randomName}`);
      setTimeout(() => setSegmentToast(null), 3000);
    }
    if (snapResult) {
      setLastSegmentIndex(snapResult.nearestSegmentIndex);
    }
  }, [snapResult?.nearestSegmentIndex, lastSegmentIndex]);
  
  // Check for completion
  useEffect(() => {
    if (completionPercent >= 95 && !showCompletion) {
      setShowCompletion(true);
    }
  }, [completionPercent, showCompletion]);
  
  // Find next critical marker (danger or stop)
  const nextCriticalMarker = useMemo(() => {
    if (!snapResult) return null;
    
    const progress = snapResult.progressMetersAlongLine;
    const criticalMarkers = markersWithKind.filter(
      m => (m.kind === 'danger' || m.kind === 'mandatory_stop') && m.distanceAlongRoute > progress
    );
    
    if (criticalMarkers.length === 0) return null;
    
    const next = criticalMarkers[0];
    return {
      ...next,
      distanceFromUser: next.distanceAlongRoute - progress,
    };
  }, [markersWithKind, snapResult]);
  
  // Is next marker close (within 150m)?
  const isMarkerClose = nextCriticalMarker && nextCriticalMarker.distanceFromUser < 150;
  
  // Current segment info (human-friendly)
  const currentSegmentName = useMemo(() => {
    if (!snapResult) return 'En attente GPS...';
    const names = ['Zone de départ', 'Chemin principal', 'Zone de transition', 'Descente', 'Montée', 'Arrivée'];
    return names[snapResult.nearestSegmentIndex % names.length];
  }, [snapResult]);
  
  // Remaining distance
  const remainingDistance = useMemo(() => {
    if (!snapResult) return totalDistance;
    return Math.max(0, totalDistance - snapResult.progressMetersAlongLine);
  }, [snapResult, totalDistance]);
  
  // Off track status
  const isOffTrack = snapResult ? snapResult.distanceToLineMeters > OFF_TRACK_THRESHOLD_METERS : false;
  
  // Start watching position
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setGpsError('Géolocalisation non disponible');
      return;
    }
    
    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const accuracy = position.coords.accuracy;
        setUserAccuracy(accuracy);
        
        if (accuracy <= MAX_ACCURACY_METERS) {
          setUserPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setGpsError(null);
        } else {
          setUserPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        }
      },
      (error) => {
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('Permission GPS refusée');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError('Position indisponible');
            break;
          case error.TIMEOUT:
            setGpsError('Délai GPS dépassé');
            break;
          default:
            setGpsError('Erreur GPS');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    );
    
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);
  
  // Default center (first point of trace or Paris)
  const defaultCenter: [number, number] = polylineCoords.length > 0
    ? [polylineCoords[0][1], polylineCoords[0][0]]
    : [48.8566, 2.3522];
  
  // Format distance for display
  const formatDistance = (meters: number): string => {
    if (meters >= 1000) {
      return `${(meters / 1000).toFixed(1)} km`;
    }
    return `${Math.round(meters)} m`;
  };
  
  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Full screen map */}
      <div className="absolute inset-0">
        <MapContainer
          center={defaultCenter}
          zoom={16}
          className="h-full w-full"
          zoomControl={false}
        >
          {/* Light OSM theme */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
            url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          />
          
          <MapController 
            coords={polylineCoords} 
            userPosition={userPosition} 
            shouldCenter={followUser} 
          />
          
          {/* Full route background (light gray) */}
          <Polyline
            positions={polylineCoords.map(c => [c[1], c[0]] as L.LatLngTuple)}
            color={COLORS.traceTotal}
            weight={6}
            opacity={0.6}
            lineCap="round"
            lineJoin="round"
          />
          
          {/* Remaining route (light gray, slightly visible) */}
          {progressPolyline.remainingCoords.length > 1 && (
            <Polyline
              positions={progressPolyline.remainingCoords.map(c => [c[1], c[0]] as L.LatLngTuple)}
              color={isOffTrack ? '#9ca3af' : COLORS.traceActive}
              weight={isOffTrack ? 4 : 7}
              opacity={isOffTrack ? 0.4 : 0.8}
              lineCap="round"
              lineJoin="round"
            />
          )}
          
          {/* Completed route (green) */}
          {progressPolyline.completedCoords.length > 1 && (
            <Polyline
              positions={progressPolyline.completedCoords.map(c => [c[1], c[0]] as L.LatLngTuple)}
              color={COLORS.traceCompleted}
              weight={7}
              opacity={1}
              lineCap="round"
              lineJoin="round"
            />
          )}
          
          {/* Departure marker */}
          {polylineCoords.length > 0 && (
            <CircleMarker
              center={[polylineCoords[0][1], polylineCoords[0][0]]}
              radius={12}
              fillColor={COLORS.departure}
              fillOpacity={1}
              color="white"
              weight={3}
            />
          )}
          
          {/* Arrival marker */}
          {polylineCoords.length > 1 && (
            <CircleMarker
              center={[polylineCoords[polylineCoords.length - 1][1], polylineCoords[polylineCoords.length - 1][0]]}
              radius={12}
              fillColor={COLORS.arrival}
              fillOpacity={1}
              color="white"
              weight={3}
            />
          )}
          
          {/* Other markers */}
          {markersWithKind.map(marker => {
            const isPulsing = nextCriticalMarker?.id === marker.id && isMarkerClose;
            return (
              <Marker
                key={marker.id}
                position={[marker.lat, marker.lng]}
                icon={createMarkerIcon(marker.kind, isPulsing)}
              >
                <Popup>
                  <div className="text-sm p-1">
                    <strong className="block mb-1">{getMarkerLabel(marker.kind)}</strong>
                    {marker.note && <p className="text-muted-foreground">{marker.note}</p>}
                  </div>
                </Popup>
              </Marker>
            );
          })}
          
          {/* User accuracy circle */}
          {userPosition && userAccuracy && (
            <CircleMarker
              center={[userPosition.lat, userPosition.lng]}
              radius={Math.min(60, userAccuracy)}
              fillColor={COLORS.userHalo}
              fillOpacity={0.3}
              color={COLORS.userPosition}
              weight={1}
              opacity={0.3}
            />
          )}
          
          {/* User position with pulsing effect */}
          {userPosition && (
            <>
              {/* Outer pulse ring */}
              <CircleMarker
                center={[userPosition.lat, userPosition.lng]}
                radius={18}
                fillColor={isOffTrack ? COLORS.danger : COLORS.userPosition}
                fillOpacity={0.15}
                color={isOffTrack ? COLORS.danger : COLORS.userPosition}
                weight={2}
                opacity={0.4}
                className="animate-pulse"
              />
              {/* Inner dot */}
              <CircleMarker
                center={[userPosition.lat, userPosition.lng]}
                radius={8}
                fillColor={isOffTrack ? COLORS.danger : COLORS.userPosition}
                fillOpacity={1}
                color="white"
                weight={3}
              />
            </>
          )}
        </MapContainer>
      </div>
      
      {/* Top floating buttons */}
      <div className="absolute top-4 left-4 right-4 z-[1000] flex justify-between pointer-events-none">
        {/* Follow user button */}
        <Button
          variant="secondary"
          size="icon"
          className={cn(
            "pointer-events-auto shadow-lg rounded-full w-12 h-12 transition-all",
            followUser ? "bg-blue-500 text-white hover:bg-blue-600" : "bg-white/90 backdrop-blur-sm"
          )}
          onClick={() => setFollowUser(!followUser)}
        >
          <Navigation className={cn("w-5 h-5", followUser && "fill-current")} />
        </Button>
        
        {/* Close button */}
        <Button
          variant="secondary"
          size="icon"
          className="pointer-events-auto shadow-lg rounded-full w-12 h-12 bg-white/90 backdrop-blur-sm"
          onClick={onClose}
        >
          <X className="w-5 h-5" />
        </Button>
      </div>
      
      {/* Off-track warning banner */}
      {isOffTrack && (
        <div className="absolute top-20 left-4 right-4 z-[1000] animate-fade-in">
          <div className="bg-red-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 justify-center">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">⚠️ Hors parcours</span>
          </div>
        </div>
      )}
      
      {/* Segment change toast */}
      <SegmentToast message={segmentToast || ''} visible={!!segmentToast} />
      
      {/* Completion overlay */}
      <CompletionOverlay visible={showCompletion} onClose={onClose} />
      
      {/* Bottom sheet */}
      <div 
        className={cn(
          "absolute bottom-0 left-0 right-0 z-[1000] transition-all duration-300 ease-out",
          bottomSheetExpanded ? "translate-y-0" : "translate-y-[calc(100%-80px)]"
        )}
      >
        {/* Handle */}
        <div 
          className="flex justify-center py-2 cursor-pointer"
          onClick={() => setBottomSheetExpanded(!bottomSheetExpanded)}
        >
          <div className="w-10 h-1.5 bg-muted-foreground/30 rounded-full" />
        </div>
        
        {/* Sheet content */}
        <div className="bg-white rounded-t-3xl shadow-2xl border-t border-border px-5 pt-2 pb-8 safe-area-bottom">
          {/* Collapsed view - always visible */}
          <div 
            className="flex items-center justify-between py-3 cursor-pointer"
            onClick={() => setBottomSheetExpanded(!bottomSheetExpanded)}
          >
            <div className="flex items-center gap-3">
              {/* Mode badge */}
              <Badge 
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-full",
                  mode === 'walk' 
                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" 
                    : "bg-blue-100 text-blue-700 hover:bg-blue-100"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  setMode(mode === 'walk' ? 'scooter' : 'walk');
                }}
              >
                {mode === 'walk' ? (
                  <><Footprints className="w-4 h-4 mr-1.5" /> Marche</>
                ) : (
                  <><Bike className="w-4 h-4 mr-1.5" /> Scooter</>
                )}
              </Badge>
              
              {/* Progress */}
              <span className="text-lg font-semibold">{completionPercent}%</span>
            </div>
            
            {/* Remaining distance */}
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">Reste</span>
              <span className="font-bold text-lg">{formatDistance(remainingDistance)}</span>
              {bottomSheetExpanded ? (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
          </div>
          
          {/* Expanded content */}
          {bottomSheetExpanded && (
            <div className="space-y-4 animate-fade-in">
              {/* Progress bar */}
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-500 ease-out rounded-full"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              
              {/* Current segment */}
              <div className="bg-muted/50 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Segment actuel</p>
                    <p className="font-semibold">{currentSegmentName}</p>
                  </div>
                </div>
              </div>
              
              {/* Next critical point */}
              {nextCriticalMarker && (
                <div className={cn(
                  "rounded-2xl p-4 transition-colors",
                  isMarkerClose 
                    ? nextCriticalMarker.kind === 'danger' 
                      ? "bg-red-50 border-2 border-red-200" 
                      : "bg-orange-50 border-2 border-orange-200"
                    : "bg-muted/50"
                )}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{getMarkerEmoji(nextCriticalMarker.kind)}</span>
                      <div>
                        <p className={cn(
                          "text-sm",
                          isMarkerClose 
                            ? nextCriticalMarker.kind === 'danger' 
                              ? "text-red-600 font-medium" 
                              : "text-orange-600 font-medium"
                            : "text-muted-foreground"
                        )}>
                          {isMarkerClose ? 'Attention !' : 'Prochain événement'}
                        </p>
                        <p className="font-semibold">{getMarkerLabel(nextCriticalMarker.kind)}</p>
                      </div>
                    </div>
                    <div className={cn(
                      "text-right px-4 py-2 rounded-xl",
                      isMarkerClose 
                        ? nextCriticalMarker.kind === 'danger'
                          ? "bg-red-100 text-red-700"
                          : "bg-orange-100 text-orange-700"
                        : "bg-muted"
                    )}>
                      <span className="text-2xl font-bold">{formatDistance(nextCriticalMarker.distanceFromUser)}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {/* GPS Status - subtle */}
              {gpsError ? (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-xl">
                  <AlertTriangle className="w-4 h-4" />
                  {gpsError}
                </div>
              ) : userPosition ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className={cn(
                    "w-2 h-2 rounded-full",
                    userAccuracy && userAccuracy <= 20 ? "bg-green-500" : 
                    userAccuracy && userAccuracy <= 40 ? "bg-yellow-500" : "bg-red-500"
                  )} />
                  <span>
                    {userAccuracy && userAccuracy <= 20 
                      ? "Vous êtes sur le bon chemin" 
                      : userAccuracy && userAccuracy <= 40
                        ? "Signal GPS moyen"
                        : "Signal GPS faible"}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                  <span>Recherche de votre position...</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
