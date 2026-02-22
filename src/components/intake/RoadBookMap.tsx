import { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface RoadBookMapProps {
  markers: { lat: number; lng: number; name: string }[];
}

export function RoadBookMap({ markers }: RoadBookMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  const validMarkers = useMemo(
    () => markers.filter(m => m.lat && m.lng),
    [markers]
  );

  useEffect(() => {
    if (!mapRef.current || validMarkers.length === 0) return;

    // Clean up previous map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false });
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OSM',
    }).addTo(map);

    const bounds: L.LatLngExpression[] = [];

    validMarkers.forEach((m, i) => {
      const latlng: L.LatLngExpression = [m.lat, m.lng];
      bounds.push(latlng);

      const icon = L.divIcon({
        className: '',
        html: `<div style="background:#2563eb;color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.3)">${i + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker(latlng, { icon })
        .addTo(map)
        .bindPopup(`<b>Étape ${i + 1}</b><br/>${m.name}`);
    });

    if (bounds.length > 0) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 16 });
    }

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [validMarkers]);

  if (validMarkers.length === 0) return null;

  return (
    <div
      ref={mapRef}
      className="w-full rounded-lg border border-border overflow-hidden mb-4"
      style={{ height: 250 }}
    />
  );
}
