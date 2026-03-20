import { useEffect, useRef, useCallback } from 'react';
import type { MedinaPOI } from '@/hooks/useMedinaPOIs';

// Lazy-load Leaflet to avoid SSR issues
let L: typeof import('leaflet') | null = null;

const CATEGORY_COLORS: Record<string, string> = {
  mosque: '#10b981',
  fountain: '#3b82f6',
  fondouk: '#f59e0b',
  gate_bab: '#8b5cf6',
  souk: '#ef4444',
  museum: '#06b6d4',
  palace: '#d97706',
  medersa: '#84cc16',
  hammam: '#f97316',
  historic: '#6366f1',
  restaurant: '#ec4899',
  cafe: '#a78bfa',
  generic: '#94a3b8',
};

const STATUS_OPACITY: Record<string, number> = {
  validated: 1.0,
  draft: 0.6,
  raw: 0.4,
  filtered: 0.2,
};

function getCategoryColor(poi: MedinaPOI): string {
  const cat = (poi as unknown as Record<string, string>).category_ai ?? poi.category ?? 'generic';
  return CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.generic;
}

function makeCircleMarker(poi: MedinaPOI) {
  if (!L) return null;
  const color = getCategoryColor(poi);
  const opacity = STATUS_OPACITY[poi.status] ?? 0.6;
  const isHub = poi.is_start_hub;
  return L.circleMarker([poi.lat!, poi.lng!], {
    radius: isHub ? 10 : 7,
    fillColor: color,
    color: isHub ? '#f59e0b' : '#fff',
    weight: isHub ? 3 : 1.5,
    opacity: 1,
    fillOpacity: opacity,
  });
}

interface MedinaMapProps {
  pois: MedinaPOI[];
  selectedId: string | null;
  onSelectPOI: (id: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  /** If true, clicking map sets coordinates for active POI */
  placeMode?: boolean;
}

export default function MedinaMap({
  pois,
  selectedId,
  onSelectPOI,
  onMapClick,
  placeMode = false,
}: MedinaMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<Map<string, import('leaflet').CircleMarker>>(new Map());
  const selectedLayerRef = useRef<import('leaflet').CircleMarker | null>(null);

  // Initialize map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    import('leaflet').then((leaflet) => {
      L = leaflet.default ?? leaflet;

      // Fix default icon paths broken by Vite bundling
      delete (L.Icon.Default.prototype as Record<string, unknown>)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, {
        center: [31.6295, -7.9811], // Jemaa el-Fna
        zoom: 15,
        zoomControl: true,
      });

      // OSM tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Click handler for place mode
      map.on('click', (e: import('leaflet').LeafletMouseEvent) => {
        if (placeMode && onMapClick) {
          onMapClick(e.latlng.lat, e.latlng.lng);
        }
      });

      mapRef.current = map;
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markersRef.current.clear();
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update place mode cursor
  useEffect(() => {
    if (!mapRef.current || !containerRef.current) return;
    containerRef.current.style.cursor = placeMode ? 'crosshair' : '';
  }, [placeMode]);

  // Sync markers when POIs change
  useEffect(() => {
    if (!mapRef.current || !L) return;
    const map = mapRef.current;
    const existing = markersRef.current;
    const newIds = new Set(pois.filter(p => p.lat != null && p.lng != null).map(p => p.id));

    // Remove stale markers
    for (const [id, marker] of existing) {
      if (!newIds.has(id)) {
        map.removeLayer(marker);
        existing.delete(id);
      }
    }

    // Add/update markers
    for (const poi of pois) {
      if (poi.lat == null || poi.lng == null) continue;
      const existing_marker = existing.get(poi.id);
      if (existing_marker) {
        existing_marker.setLatLng([poi.lat, poi.lng]);
        // Update style
        const color = getCategoryColor(poi);
        const opacity = STATUS_OPACITY[poi.status] ?? 0.6;
        existing_marker.setStyle({
          fillColor: color,
          fillOpacity: opacity,
          color: poi.is_start_hub ? '#f59e0b' : '#fff',
          weight: poi.is_start_hub ? 3 : 1.5,
          radius: poi.is_start_hub ? 10 : 7,
        });
      } else {
        const marker = makeCircleMarker(poi);
        if (!marker) continue;
        marker.addTo(map);
        marker.bindTooltip(poi.name, { direction: 'top', offset: [0, -6] });
        marker.on('click', () => onSelectPOI(poi.id));
        existing.set(poi.id, marker);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pois]);

  // Highlight selected POI
  useEffect(() => {
    if (!L) return;
    // Reset previous selection
    if (selectedLayerRef.current) {
      const prevPoi = pois.find(p => {
        const m = markersRef.current.get(p.id);
        return m === selectedLayerRef.current;
      });
      if (prevPoi) {
        selectedLayerRef.current.setStyle({
          color: prevPoi.is_start_hub ? '#f59e0b' : '#fff',
          weight: prevPoi.is_start_hub ? 3 : 1.5,
          radius: prevPoi.is_start_hub ? 10 : 7,
        });
      }
      selectedLayerRef.current = null;
    }

    if (!selectedId) return;
    const marker = markersRef.current.get(selectedId);
    if (!marker) return;

    marker.setStyle({ color: '#ffffff', weight: 3, radius: 12 });
    selectedLayerRef.current = marker;

    // Pan to selected
    const poi = pois.find(p => p.id === selectedId);
    if (poi?.lat && poi?.lng && mapRef.current) {
      mapRef.current.panTo([poi.lat, poi.lng], { animate: true, duration: 0.3 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border border-border">
      <div ref={containerRef} className="w-full h-full" />
      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-background/90 backdrop-blur-sm rounded-lg p-2 text-[10px] space-y-1 z-[1000] pointer-events-none">
        {Object.entries(CATEGORY_COLORS).slice(0, 8).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-muted-foreground">{cat}</span>
          </div>
        ))}
      </div>
      {placeMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs px-3 py-1.5 rounded-full z-[1000] shadow-md">
          Cliquez sur la carte pour placer le POI
        </div>
      )}
    </div>
  );
}
