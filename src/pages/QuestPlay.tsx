import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePlayInstance, type PlayData } from '@/hooks/usePlayInstance';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Clock, MapPin, AlertTriangle, Eye } from 'lucide-react';

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function QuestPlay() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { loading, error, data, start, isStarted, isExpired, remainingSeconds } = usePlayInstance(token);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);

  // Auto-call start on mount if we have a token (idempotent)
  useEffect(() => {
    if (token) start();
  }, [token, start]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Token manquant</h1>
            <p className="text-muted-foreground">Utilisez un lien valide avec un token d'accès.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground animate-pulse">Chargement…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-bold mb-2">Erreur</h1>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { instance, project, pois } = data;
  const title = project.title_i18n?.fr || project.title_i18n?.en || project.city || 'Quest';
  const experienceMode = ((instance as unknown) as Record<string, unknown>).experience_mode as string || 'game';
  const selectedPoi = pois.find((p) => p.id === selectedPoiId);

  // Not started yet → show start screen
  if (!isStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">{title}</CardTitle>
            <p className="text-muted-foreground">{project.city}</p>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <div className="flex justify-center gap-2">
              {experienceMode && <Badge variant="outline">{experienceMode}</Badge>}
              <Badge variant="outline">{instance.ttl_minutes} min</Badge>
              <Badge variant="outline">{pois.length} étapes</Badge>
            </div>
            <Button size="lg" className="w-full" onClick={start} disabled={loading}>
              <Play className="w-5 h-5 mr-2" /> Démarrer
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Started → main player view
  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Expiration banners */}
      {isExpired && experienceMode === 'game' && (
        <div className="bg-destructive text-destructive-foreground px-4 py-2 text-center text-sm font-medium">
          ⏱ Expiré — progression verrouillée
        </div>
      )}
      {isExpired && experienceMode === 'visit' && (
        <div className="bg-accent text-accent-foreground px-4 py-2 text-center text-sm font-medium">
          ⏱ Expiré — lecture disponible
        </div>
      )}

      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-semibold">{title}</h1>
          <p className="text-xs text-muted-foreground">{project.city}</p>
        </div>
        {remainingSeconds !== null && !isExpired && (
          <div className="flex items-center gap-2 text-sm font-mono">
            <Clock className="w-4 h-4" />
            <span className={remainingSeconds < 300 ? 'text-destructive font-bold' : ''}>{formatTime(remainingSeconds)}</span>
          </div>
        )}
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* POI list */}
        <aside className="w-64 border-r bg-card overflow-y-auto shrink-0 hidden md:block">
          <nav className="p-2 space-y-1">
            {pois.map((poi, i) => (
              <button
                key={poi.id}
                onClick={() => setSelectedPoiId(poi.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedPoiId === poi.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                }`}
              >
                <span className="font-medium">{i + 1}. {poi.name}</span>
                <span className="block text-xs opacity-70">{poi.zone} · {poi.interaction}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Mobile POI list */}
        <div className="md:hidden border-b bg-card overflow-x-auto flex gap-1 p-2 shrink-0">
          {pois.map((poi, i) => (
            <button
              key={poi.id}
              onClick={() => setSelectedPoiId(poi.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedPoiId === poi.id ? 'bg-primary text-primary-foreground' : 'bg-muted'
              }`}
            >
              {i + 1}. {poi.name}
            </button>
          ))}
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4">
          {selectedPoi ? (
            <POIDetail poi={selectedPoi} />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
              <MapPin className="w-10 h-10" />
              <p>Sélectionnez une étape</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

/* ─── POI Detail ─── */
function POIDetail({ poi }: { poi: NonNullable<PlayData['pois'][number]> }) {
  const config = poi.step_config || {};
  const geo = config.geo as Record<string, unknown> | undefined;
  const media = config.media as Record<string, string[]> | undefined;
  const contentI18n = config.contentI18n as Record<string, string> | undefined;
  const hints = config.hints as string[] | undefined;

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">{poi.name}</h2>
        <div className="flex gap-2 mt-1">
          <Badge variant="outline">{poi.interaction}</Badge>
          <Badge variant="outline">{poi.zone}</Badge>
        </div>
      </div>

      {/* Content / story */}
      {contentI18n && Object.keys(contentI18n).length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm whitespace-pre-wrap">
              {contentI18n.fr || contentI18n.en || Object.values(contentI18n)[0]}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Geo info */}
      {geo && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1">
              <MapPin className="w-4 h-4" /> Coordonnées
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs font-mono space-y-1">
            <p>Lat: {String(geo.lat)} · Lng: {String(geo.lng)}</p>
            <p>Rayon: {String(geo.radius_m)}m · Zone: {String(geo.zone)}</p>
          </CardContent>
        </Card>
      )}

      {/* Media references (IDs only for V1) */}
      {media && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1">
              <Eye className="w-4 h-4" /> Médias liés
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {media.coverPhotoId && (
              <p>📷 Cover: <code className="bg-muted px-1 rounded">{media.coverPhotoId}</code></p>
            )}
            {(media.photoIds as string[])?.length > 0 && (
              <p>📷 Photos: {(media.photoIds as string[]).length} fichier(s)</p>
            )}
            {(media.audioIds as string[])?.length > 0 && (
              <p>🔊 Audio: {(media.audioIds as string[]).length} fichier(s)</p>
            )}
            {(media.videoIds as string[])?.length > 0 && (
              <p>🎬 Vidéo: {(media.videoIds as string[]).length} fichier(s)</p>
            )}
            <p className="text-muted-foreground italic">
              Les assets seront disponibles via endpoint sécurisé (prochain patch).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Hints */}
      {hints && hints.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Indices ({hints.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {hints.map((h, i) => (
              <p key={i} className="text-sm">💡 {h}</p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Raw config fallback */}
      {!contentI18n && !geo && !media && (
        <Card>
          <CardContent className="p-4">
            <pre className="text-xs overflow-auto max-h-40">
              {JSON.stringify(config, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
