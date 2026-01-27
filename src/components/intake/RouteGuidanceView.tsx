import { useState, useEffect, useRef, useMemo } from 'react';
import { X, Navigation, AlertTriangle, MapPin, Flag, Loader2 } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import type { RouteTrace, RouteMarker } from '@/hooks/useRouteRecorder';
import {
  snapToPolyline,
  computeProgressPolyline,
  inferMarkerKind,
  getMarkerEmoji,
  haversineDistance,
  type MarkerKind,
  type Coord,
} from '@/lib/routeGeometry';

// Max accuracy to consider GPS valid
const MAX_ACCURACY_METERS = 40;
// Distance threshold to show "hors trace" warning
const OFF_TRACK_THRESHOLD_METERS = 30;

interface RouteGuidanceViewProps {
  trace: RouteTrace;
  markers: RouteMarker[];
  onClose: () => void;
}

// Custom marker icons using divIcon
function createMarkerIcon(kind: MarkerKind): L.DivIcon {
  const emoji = getMarkerEmoji(kind);
  return L.divIcon({
    html: `<span style="font-size: 24px;">${emoji}</span>`,
    className: 'bg-transparent border-0',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

// Component to auto-fit map bounds
function FitBounds({ coords }: { coords: [number, number][] }) {
  const map = useMap();
  
  useEffect(() => {
    if (coords.length > 0) {
      const latLngs = coords.map(c => [c[1], c[0]] as [number, number]);
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, coords]);
  
  return null;
}

// Component to center on user position
function CenterOnUser({ position, shouldCenter }: { position: Coord | null; shouldCenter: boolean }) {
  const map = useMap();
  
  useEffect(() => {
    if (position && shouldCenter) {
      map.setView([position.lat, position.lng], map.getZoom());
    }
  }, [map, position, shouldCenter]);
  
  return null;
}

interface MarkerWithKind extends RouteMarker {
  kind: MarkerKind;
  distanceAlongRoute: number;
}

export function RouteGuidanceView({ trace, markers, onClose }: RouteGuidanceViewProps) {
  const [userPosition, setUserPosition] = useState<Coord | null>(null);
  const [userAccuracy, setUserAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [followUser, setFollowUser] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  
  const polylineCoords = trace.geojson.coordinates as [number, number][];
  
  // Parse markers with kind and distance along route
  const markersWithKind = useMemo<MarkerWithKind[]>(() => {
    return markers.map(m => {
      const kind = inferMarkerKind(m.note);
      // Find distance along route for this marker
      const snap = snapToPolyline({ lat: m.lat, lng: m.lng }, polylineCoords);
      return {
        ...m,
        kind,
        distanceAlongRoute: snap?.progressMetersAlongLine || 0,
      };
    }).sort((a, b) => a.distanceAlongRoute - b.distanceAlongRoute);
  }, [markers, polylineCoords]);
  
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
  
  // Current segment info
  const currentSegment = useMemo(() => {
    if (!snapResult) return null;
    
    const segIdx = snapResult.nearestSegmentIndex;
    const totalSegments = polylineCoords.length - 1;
    
    return {
      index: segIdx + 1,
      total: totalSegments,
    };
  }, [snapResult, polylineCoords]);
  
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
          // Still update position but show warning
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
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="max-w-[95vw] w-full h-[90vh] p-0 flex flex-col md:flex-row gap-0">
        {/* Map */}
        <div className="flex-1 relative min-h-[50vh] md:min-h-0">
          <MapContainer
            center={defaultCenter}
            zoom={15}
            className="h-full w-full"
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            
            <FitBounds coords={polylineCoords} />
            <CenterOnUser position={userPosition} shouldCenter={followUser} />
            
            {/* Remaining route (gray) */}
            {progressPolyline.remainingCoords.length > 1 && (
              <Polyline
                positions={progressPolyline.remainingCoords.map(c => [c[1], c[0]] as L.LatLngTuple)}
                color="#9ca3af"
                weight={4}
                opacity={0.7}
              />
            )}
            
            {/* Completed route (primary color) */}
            {progressPolyline.completedCoords.length > 1 && (
              <Polyline
                positions={progressPolyline.completedCoords.map(c => [c[1], c[0]] as L.LatLngTuple)}
                color="hsl(var(--primary))"
                weight={5}
                opacity={1}
              />
            )}
            
            {/* Markers */}
            {markersWithKind.map(marker => (
              <Marker
                key={marker.id}
                position={[marker.lat, marker.lng]}
                icon={createMarkerIcon(marker.kind)}
              >
                <Popup>
                  <div className="text-sm">
                    <strong>{getMarkerEmoji(marker.kind)} {marker.kind}</strong>
                    {marker.note && <p className="mt-1">{marker.note}</p>}
                  </div>
                </Popup>
              </Marker>
            ))}
            
            {/* User position */}
            {userPosition && (
              <CircleMarker
                center={[userPosition.lat, userPosition.lng]}
                radius={10}
                fillColor={isOffTrack ? '#ef4444' : '#22c55e'}
                fillOpacity={0.9}
                color="white"
                weight={3}
              />
            )}
          </MapContainer>
          
          {/* Close button */}
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-4 right-4 z-[1000] shadow-lg"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
          
          {/* Follow toggle */}
          <Button
            variant={followUser ? 'default' : 'secondary'}
            size="icon"
            className="absolute top-4 left-4 z-[1000] shadow-lg"
            onClick={() => setFollowUser(!followUser)}
            title={followUser ? 'Suivi actif' : 'Suivi désactivé'}
          >
            <Navigation className={cn("w-5 h-5", followUser && "text-primary-foreground")} />
          </Button>
        </div>
        
        {/* Info panel */}
        <div className="w-full md:w-80 bg-background border-t md:border-t-0 md:border-l p-4 overflow-y-auto">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-lg">Guidage</h2>
              <Badge variant="outline">
                {trace.distance_meters ? formatDistance(trace.distance_meters) : '—'}
              </Badge>
            </div>
            
            {/* GPS Status */}
            <Card>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Statut GPS</span>
                  {gpsError ? (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      {gpsError}
                    </Badge>
                  ) : userPosition ? (
                    <Badge 
                      variant={userAccuracy && userAccuracy <= 20 ? 'default' : 'secondary'} 
                      className={cn(
                        "text-xs",
                        userAccuracy && userAccuracy <= 20 
                          ? "bg-primary" 
                          : userAccuracy && userAccuracy <= 40 
                            ? "bg-accent text-accent-foreground" 
                            : "bg-destructive"
                      )}
                    >
                      {userAccuracy ? `±${Math.round(userAccuracy)}m` : 'Actif'}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      Recherche...
                    </Badge>
                  )}
                </div>
                
                {isOffTrack && (
                  <div className="flex items-center gap-2 text-amber-600 bg-amber-50 dark:bg-amber-950/30 p-2 rounded text-sm">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Hors trace ({snapResult ? Math.round(snapResult.distanceToLineMeters) : '?'}m)</span>
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Current segment */}
            {currentSegment && (
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Segment actuel</span>
                    <span className="font-medium">{currentSegment.index} / {currentSegment.total}</span>
                  </div>
                  {snapResult && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      Progression: {formatDistance(snapResult.progressMetersAlongLine)}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
            
            {/* Next critical point */}
            <Card>
              <CardContent className="p-3">
                <div className="text-sm text-muted-foreground mb-2">Prochain point critique</div>
                {nextCriticalMarker ? (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{getMarkerEmoji(nextCriticalMarker.kind)}</span>
                    <div className="flex-1">
                      <div className="font-medium capitalize">{nextCriticalMarker.kind.replace('_', ' ')}</div>
                      <div className="text-sm text-muted-foreground">
                        {nextCriticalMarker.note?.substring(0, 50) || '—'}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-lg font-mono">
                      {formatDistance(nextCriticalMarker.distanceFromUser)}
                    </Badge>
                  </div>
                ) : (
                  <div className="text-muted-foreground text-sm">
                    Aucun point critique à venir
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* All markers list */}
            <Card>
              <CardContent className="p-3">
                <div className="text-sm text-muted-foreground mb-2">
                  Tous les marqueurs ({markersWithKind.length})
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {markersWithKind.map(marker => (
                    <div key={marker.id} className="flex items-center gap-2 text-sm">
                      <span>{getMarkerEmoji(marker.kind)}</span>
                      <span className="flex-1 truncate">{marker.note || '(sans note)'}</span>
                      <span className="text-xs text-muted-foreground">
                        {formatDistance(marker.distanceAlongRoute)}
                      </span>
                    </div>
                  ))}
                  {markersWithKind.length === 0 && (
                    <div className="text-muted-foreground text-sm">Aucun marqueur</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
