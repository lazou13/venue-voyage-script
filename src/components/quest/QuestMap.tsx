import { useEffect, useRef, useState, useCallback } from 'react';
import type { PlayData } from '@/hooks/usePlayInstance';

// ── Types ──────────────────────────────────────────────────
interface QuestMapProps {
  pois: PlayData['pois'];
  selectedPoiId: string | null;
  visitedIds: Set<string>;
  coverUrls: Record<string, string>;
  onSelectPOI: (id: string) => void;
  onCheckin?: (poiId: string) => void;
}

interface GpsPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

// ── Haversine distance in meters ───────────────────────────
function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Adaptive validation radius ────────────────────────────
// Larger radius in narrow streets / derbs, smaller on open plazas
function getValidationRadius(poi: PlayData['pois'][number]): number {
  const cfg = poi.step_config as Record<string, unknown> | null;
  const geo = cfg?.geo as Record<string, unknown> | null;
  const baseRadius = (geo?.radius_m as number) ?? (poi as unknown as Record<string, number>).radius_m ?? 30;
  const streetType = (poi as unknown as Record<string, string>).street_type;

  if (streetType === 'derb' || streetType === 'covered_passage') return Math.max(baseRadius, 50);
  if (streetType === 'plaza' || streetType === 'main_street') return Math.min(baseRadius, 20);
  // Default: use configured value but clamp for GPS accuracy
  return Math.max(baseRadius, 25);
}

// ── Leaflet lazy ref ──────────────────────────────────────
let L: typeof import('leaflet') | null = null;

export default function QuestMap({ pois, selectedPoiId, visitedIds, onSelectPOI, onCheckin }: QuestMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<Map<string, import('leaflet').CircleMarker>>(new Map());
  const playerMarkerRef = useRef<import('leaflet').CircleMarker | null>(null);
  const accuracyCircleRef = useRef<import('leaflet').Circle | null>(null);

  const [gps, setGps] = useState<GpsPosition | null>(null);
  const [nearbyPoiId, setNearbyPoiId] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // ── Init map ──────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    import('leaflet').then((leaflet) => {
      L = leaflet.default ?? leaflet;

      delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, {
        center: [31.6295, -7.9811],
        zoom: 16,
        zoomControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OSM',
        maxZoom: 19,
      }).addTo(map);

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── GPS watch ─────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { setGpsError('GPS non disponible'); return; }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGpsError(null);
      },
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 3000 }
    );

    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  // ── Update player marker + proximity check ─────────────────
  useEffect(() => {
    if (!gps || !mapRef.current || !L) return;
    const map = mapRef.current;

    if (!playerMarkerRef.current) {
      // Blue pulsing dot for player
      playerMarkerRef.current = L.circleMarker([gps.lat, gps.lng], {
        radius: 8,
        fillColor: '#3b82f6',
        color: '#fff',
        weight: 2,
        fillOpacity: 0.9,
      }).addTo(map);
      playerMarkerRef.current.bindTooltip('Vous êtes ici', { permanent: false });
    } else {
      playerMarkerRef.current.setLatLng([gps.lat, gps.lng]);
    }

    // Accuracy circle
    if (accuracyCircleRef.current) {
      map.removeLayer(accuracyCircleRef.current);
    }
    accuracyCircleRef.current = L.circle([gps.lat, gps.lng], {
      radius: gps.accuracy,
      fillColor: '#3b82f6',
      color: '#3b82f6',
      weight: 1,
      fillOpacity: 0.08,
    }).addTo(map);

    // ── Proximity check ──────────────────────────────────────
    let closestId: string | null = null;
    let closestDist = Infinity;
    for (const poi of pois) {
      const poiRecord = poi as unknown as Record<string, number | null>;
      const lat = poiRecord.lat as number | null;
      const lng = poiRecord.lng as number | null;
      if (lat == null || lng == null) continue;
      if (visitedIds.has(poi.id)) continue;
      const dist = haversineM(gps.lat, gps.lng, lat, lng);
      const radius = getValidationRadius(poi);
      if (dist <= radius && dist < closestDist) {
        closestDist = dist;
        closestId = poi.id;
      }
    }
    setNearbyPoiId(closestId);
  }, [gps, pois, visitedIds]);

  // ── Sync POI markers ──────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !L) return;
    const map = mapRef.current;
    const existing = markersRef.current;
    const activePois = pois.filter(p => {
      const rec = p as unknown as Record<string, number | null>;
      return rec.lat != null && rec.lng != null;
    });
    const activeIds = new Set(activePois.map(p => p.id));

    // Remove stale
    for (const [id, m] of existing) {
      if (!activeIds.has(id)) { map.removeLayer(m); existing.delete(id); }
    }

    for (const poi of activePois) {
      const rec = poi as unknown as Record<string, number>;
      const visited = visitedIds.has(poi.id);
      const isSelected = poi.id === selectedPoiId;
      const isNearby = poi.id === nearbyPoiId;

      const color = visited ? '#10b981' : isNearby ? '#f59e0b' : '#ef4444';
      const radius = isSelected ? 12 : isNearby ? 10 : 7;
      const weight = isSelected || isNearby ? 3 : 1.5;

      if (existing.has(poi.id)) {
        const m = existing.get(poi.id)!;
        m.setStyle({ fillColor: color, radius, weight });
      } else {
        const m = L!.circleMarker([rec.lat, rec.lng], {
          radius,
          fillColor: color,
          color: '#fff',
          weight,
          fillOpacity: visited ? 0.5 : 0.9,
        }).addTo(map);
        m.bindTooltip(poi.name, { direction: 'top', offset: [0, -8] });
        m.on('click', () => onSelectPOI(poi.id));
        existing.set(poi.id, m);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pois, visitedIds, selectedPoiId, nearbyPoiId]);

  // ── Pan to selected POI ────────────────────────────────────
  useEffect(() => {
    if (!selectedPoiId || !mapRef.current) return;
    const poi = pois.find(p => p.id === selectedPoiId);
    const rec = poi as unknown as Record<string, number> | undefined;
    if (rec?.lat && rec?.lng) {
      mapRef.current.panTo([rec.lat, rec.lng], { animate: true, duration: 0.4 });
    }
  }, [selectedPoiId, pois]);

  const handleCheckin = useCallback(() => {
    if (nearbyPoiId && onCheckin) {
      onCheckin(nearbyPoiId);
    }
  }, [nearbyPoiId, onCheckin]);

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* GPS status bar */}
      <div className="absolute top-2 left-2 right-2 z-[1000] flex gap-2">
        {gpsError ? (
          <div className="bg-destructive/90 text-destructive-foreground text-xs px-3 py-1.5 rounded-full">
            GPS: {gpsError}
          </div>
        ) : gps ? (
          <div className="bg-background/90 backdrop-blur-sm text-xs px-3 py-1.5 rounded-full">
            📡 Précision: ±{Math.round(gps.accuracy)}m
          </div>
        ) : (
          <div className="bg-background/90 backdrop-blur-sm text-xs px-3 py-1.5 rounded-full animate-pulse">
            Acquisition GPS…
          </div>
        )}
      </div>

      {/* Proximity check-in button */}
      {nearbyPoiId && onCheckin && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-[1000]">
          <button
            onClick={handleCheckin}
            className="bg-amber-500 hover:bg-amber-600 text-white font-semibold px-6 py-3 rounded-full shadow-lg text-sm animate-bounce"
          >
            ✓ Valider cette étape
          </button>
        </div>
      )}

      {/* Map legend */}
      <div className="absolute bottom-3 right-3 bg-background/90 backdrop-blur-sm rounded-lg p-2 text-[10px] space-y-1 z-[1000]">
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500" /> À faire</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Vous y êtes!</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Visité</div>
        <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Vous</div>
      </div>
    </div>
  );
}
