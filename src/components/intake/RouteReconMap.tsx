import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression, LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RouteTrace, RouteMarker, RouteCoord } from '@/hooks/useRouteRecorder';

interface RouteReconMapProps {
  trace: RouteTrace | null;
  markers: RouteMarker[];
  liveCoords?: RouteCoord[];
  lastPosition?: RouteCoord | null;
  onMarkerClick?: (markerId: string) => void;
  className?: string;
}

// Auto-fit bounds
function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 17 });
    }
  }, [map, bounds]);
  return null;
}

export function RouteReconMap({ trace, markers, liveCoords, lastPosition, onMarkerClick, className }: RouteReconMapProps) {
  const { tracePositions, bounds, center } = useMemo(() => {
    const positions: LatLngTuple[] = [];

    // From saved trace
    if (trace?.geojson?.coordinates?.length) {
      trace.geojson.coordinates.forEach(c => {
        if (c.length >= 2) positions.push([c[1], c[0]]);
      });
    }

    // From live recording coords
    if (liveCoords?.length) {
      liveCoords.forEach(c => positions.push([c.lat, c.lng]));
    }

    // Marker positions for bounds
    const allPoints = [...positions];
    markers.forEach(m => allPoints.push([m.lat, m.lng]));

    let bounds: LatLngBoundsExpression | null = null;
    let center: LatLngTuple = [31.63, -8.0]; // Default Marrakech

    if (allPoints.length >= 2) {
      const lats = allPoints.map(p => p[0]);
      const lngs = allPoints.map(p => p[1]);
      bounds = [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ];
      center = [
        (Math.min(...lats) + Math.max(...lats)) / 2,
        (Math.min(...lngs) + Math.max(...lngs)) / 2,
      ];
    } else if (allPoints.length === 1) {
      center = allPoints[0];
    }

    return { tracePositions: positions, bounds, center };
  }, [trace, liveCoords, markers]);

  return (
    <div className={className || 'h-64 w-full rounded-md overflow-hidden border'}>
      <MapContainer
        center={center}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds bounds={bounds} />

        {/* Trace polyline */}
        {tracePositions.length >= 2 && (
          <Polyline
            positions={tracePositions}
            pathOptions={{ color: '#3b82f6', weight: 4, opacity: 0.8 }}
          />
        )}

        {/* Markers */}
        {markers.map((marker, idx) => (
          <CircleMarker
            key={marker.id}
            center={[marker.lat, marker.lng]}
            radius={8}
            pathOptions={{
              color: marker.promoted ? '#16a34a' : '#f59e0b',
              fillColor: marker.promoted ? '#22c55e' : '#fbbf24',
              fillOpacity: 0.9,
              weight: 2,
            }}
            eventHandlers={{ click: () => onMarkerClick?.(marker.id) }}
          >
            <Popup>
              <div className="max-w-[200px]">
                <p className="font-medium text-sm">Marqueur {idx + 1}</p>
                {marker.note && <p className="text-xs mt-1">{marker.note.slice(0, 100)}</p>}
                {marker.photo_url && (
                  <img src={marker.photo_url} alt="" className="mt-1 rounded w-full h-20 object-cover" />
                )}
                {marker.promoted && (
                  <span className="text-xs text-green-600 font-medium">✓ En bibliothèque</span>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}

        {/* Current position (pulsing) */}
        {lastPosition && (
          <CircleMarker
            center={[lastPosition.lat, lastPosition.lng]}
            radius={10}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 0.5,
              weight: 3,
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
