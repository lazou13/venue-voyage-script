import { useEffect, useState, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { supabase } from '@/integrations/supabase/client';
import { externalSupabase } from '@/lib/externalSupabase';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, MapPin, Navigation, X, ChevronRight, ChevronLeft } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface POI {
  id: string;
  name: string;
  lat: number;
  lng: number;
  history_context: string | null;
  local_anecdote: string | null;
  category_ai: string | null;
}

interface QuestStop {
  order: number;
  name: string;
  lat: number;
  lng: number;
  riddle?: string;
  story?: string;
  description?: string;
  points?: number;
  walk_time_min?: number;
}

interface QuestResult {
  title: string;
  teaser: string;
  stops: QuestStop[];
  total_distance_m: number;
  total_time_min: number;
  total_points: number;
}

const MARRAKECH_CENTER: [number, number] = [31.6295, -7.9811];

export default function HomePage() {
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [questLoading, setQuestLoading] = useState(false);
  const [quest, setQuest] = useState<QuestResult | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('medina_pois')
        .select('id, name, lat, lng, description_short, history_context, local_anecdote, category_ai')
        .eq('is_active', true)
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .limit(2000);

      if (!error && data) {
        setPois(data.map((p: any) => ({
          id: p.id,
          name: p.name,
          lat: p.lat,
          lng: p.lng,
          history_context: p.history_context || p.description_short,
          local_anecdote: p.local_anecdote,
          category_ai: p.category_ai,
        })));
      }
      setLoading(false);
    })();
  }, []);

  const startQuest = useCallback(async () => {
    setQuestLoading(true);
    setError(null);
    try {
      let startLat = MARRAKECH_CENTER[0];
      let startLng = MARRAKECH_CENTER[1];
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 })
        );
        const dist = Math.sqrt(Math.pow(position.coords.latitude - MARRAKECH_CENTER[0], 2) + Math.pow(position.coords.longitude - MARRAKECH_CENTER[1], 2));
        if (dist < 0.02) {
          startLat = position.coords.latitude;
          startLng = position.coords.longitude;
        }
      } catch { /* use default */ }

      const { data, error: fnError } = await supabase.functions.invoke('generate-quest', {
        body: { start_lat: startLat, start_lng: startLng, mode: 'treasure_hunt', theme: 'complete', max_duration_min: 90, radius_m: 800, max_stops: 6, language: 'fr' },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      setQuest(data as QuestResult);
      setCurrentStep(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setQuestLoading(false);
    }
  }, []);

  const poiIcon = new L.Icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  });

  return (
    <div className="relative h-screen w-full">
      <MapContainer center={MARRAKECH_CENTER} zoom={15} className="h-full w-full z-0">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {pois.map((poi) => (
          <Marker key={poi.id} position={[poi.lat, poi.lng]} icon={poiIcon}>
            <Popup maxWidth={280}>
              <div className="space-y-1">
                <h3 className="font-bold text-sm">{poi.name}</h3>
                {poi.history_context && <p className="text-xs text-gray-600 line-clamp-3">{poi.history_context}</p>}
                {poi.local_anecdote && <p className="text-xs italic text-gray-500 line-clamp-2">{poi.local_anecdote}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
        {quest?.stops.map((stop, i) => (
          <Marker key={`quest-${i}`} position={[stop.lat, stop.lng]}
            icon={new L.DivIcon({
              className: 'quest-marker',
              html: `<div style="background:hsl(var(--primary));color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)">${stop.order}</div>`,
              iconSize: [28, 28], iconAnchor: [14, 14],
            })}
          >
            <Popup><h3 className="font-bold text-sm">Étape {stop.order}: {stop.name}</h3></Popup>
          </Marker>
        ))}
      </MapContainer>

      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!loading && !quest && (
        <div className="absolute top-4 left-4 z-10">
          <Card className="px-3 py-2 bg-background/90 backdrop-blur">
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-primary" />
              <span className="font-medium">{pois.length} lieux</span>
              <span className="text-muted-foreground">dans la médina</span>
            </div>
          </Card>
        </div>
      )}

      {!quest && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
          <Button size="lg" onClick={startQuest} disabled={questLoading} className="shadow-lg text-base px-8 py-6 rounded-full">
            {questLoading ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" />Génération…</>) : (<><Navigation className="mr-2 h-5 w-5" />Démarrer une quête</>)}
          </Button>
          {error && <Card className="mt-3 p-3 bg-destructive/10 border-destructive/30 text-destructive text-sm text-center max-w-sm">{error}</Card>}
        </div>
      )}

      {quest && (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-background/95 backdrop-blur border-t rounded-t-2xl shadow-2xl max-h-[50vh] overflow-auto">
          <div className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold text-lg">{quest.title}</h2>
                <p className="text-sm text-muted-foreground">{quest.teaser}</p>
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                  <span>{quest.stops.length} étapes</span>
                  <span>~{quest.total_time_min} min</span>
                  <span>{quest.total_points} pts</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setQuest(null)}><X className="h-4 w-4" /></Button>
            </div>
            {quest.stops.length > 0 && (
              <Card className="p-4 border-primary/30 bg-primary/5">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-primary text-primary-foreground rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold">{quest.stops[currentStep].order}</span>
                  <h3 className="font-semibold">{quest.stops[currentStep].name}</h3>
                </div>
                {quest.stops[currentStep].riddle && <p className="text-sm mb-2 italic">🧩 {quest.stops[currentStep].riddle}</p>}
                {quest.stops[currentStep].story && <p className="text-sm text-muted-foreground">{quest.stops[currentStep].story}</p>}
                {quest.stops[currentStep].description && !quest.stops[currentStep].story && <p className="text-sm text-muted-foreground">{quest.stops[currentStep].description}</p>}
                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                  {quest.stops[currentStep].walk_time_min != null && <span>🚶 {quest.stops[currentStep].walk_time_min} min</span>}
                  {quest.stops[currentStep].points != null && <span>⭐ {quest.stops[currentStep].points} pts</span>}
                </div>
              </Card>
            )}
            <div className="flex justify-between">
              <Button variant="outline" size="sm" disabled={currentStep === 0} onClick={() => setCurrentStep(s => s - 1)}><ChevronLeft className="h-4 w-4 mr-1" /> Précédent</Button>
              <Button size="sm" disabled={currentStep === quest.stops.length - 1} onClick={() => setCurrentStep(s => s + 1)}>Suivant <ChevronRight className="h-4 w-4 ml-1" /></Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
