import { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePlayInstance, type PlayData, getPriorityMediaIds } from '@/hooks/usePlayInstance';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Play, Clock, MapPin, AlertTriangle, Eye, ChevronRight, ArrowLeft, CheckCircle2, Smartphone, MessageCircle, Map as MapIcon, List } from 'lucide-react';
import { ClientFeedbackSection } from '@/components/quest/ClientFeedbackSection';

const QuestMap = lazy(() => import('@/components/quest/QuestMap'));

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function QuestPlay() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { loading, error, data, start, isStarted, isExpired, remainingSeconds, getMediaUrls, coverUrls } = usePlayInstance(token);
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [mobileShowList, setMobileShowList] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  // Auto-call start on mount if we have a token (idempotent)
  useEffect(() => {
    if (token) start();
  }, [token, start]);

  // Mark POI as visited when selected
  useEffect(() => {
    if (selectedPoiId) {
      setVisitedIds((prev) => {
        if (prev.has(selectedPoiId)) return prev;
        const next = new Set(prev);
        next.add(selectedPoiId);
        return next;
      });
    }
  }, [selectedPoiId]);

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
    const isExpiredError = error === 'expired' || error === 'Instance expirée';
    const isDeviceLocked = error === 'device_locked';
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            {isDeviceLocked ? (
              <>
                <Smartphone className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h1 className="text-xl font-bold mb-2">Appareil non autorisé</h1>
                <p className="text-muted-foreground mb-4">
                  Cette expérience est déjà utilisée sur un autre téléphone.
                </p>
                <Button variant="outline" size="sm" asChild>
                  <a href="https://wa.me/212600000000?text=Bonjour%2C%20j%27ai%20un%20probl%C3%A8me%20d%27acc%C3%A8s%20%C3%A0%20mon%20exp%C3%A9rience" target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="w-4 h-4 mr-2" /> Assistance
                  </a>
                </Button>
              </>
            ) : isExpiredError ? (
              <>
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h1 className="text-xl font-bold mb-2">Expérience expirée</h1>
                <p className="text-muted-foreground">Cette session a expiré. Merci d'avoir participé !</p>
              </>
            ) : (
              <>
                <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
                <h1 className="text-xl font-bold mb-2">Erreur</h1>
                <p className="text-muted-foreground">{error}</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { instance, project, pois } = data;
  const title = project.title_i18n?.fr || project.title_i18n?.en || project.city || 'Quest';
  const experienceMode = ((instance as unknown) as Record<string, unknown>).experience_mode as string || 'game';
  const isVisit = experienceMode === 'visit';
  const selectedPoi = pois.find((p) => p.id === selectedPoiId);

  // Next recommended (first unvisited)
  const nextUnvisited = pois.find((p) => !visitedIds.has(p.id));

  const selectPoi = (id: string) => {
    setSelectedPoiId(id);
    setMobileShowList(false);
    if (viewMode === 'map') setViewMode('list');
  };

  const handleCheckin = (poiId: string) => {
    setVisitedIds((prev) => {
      const next = new Set(prev);
      next.add(poiId);
      return next;
    });
    setSelectedPoiId(poiId);
    setMobileShowList(false);
  };

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
              <Badge variant="outline">{isVisit ? 'Visite guidée' : 'Jeu'}</Badge>
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
      {isExpired && !isVisit && (
        <div className="bg-destructive text-destructive-foreground px-4 py-2 text-center text-sm font-medium">
          ⏱ Expiré — progression verrouillée
        </div>
      )}
      {isExpired && isVisit && (
        <div className="bg-accent text-accent-foreground px-4 py-2 text-center text-sm font-medium">
          ⏱ Expiré — lecture disponible
        </div>
      )}

      {/* Game mode banner */}
      {!isVisit && !isExpired && (
        <div className="bg-muted px-4 py-1.5 text-center text-xs text-muted-foreground">
          🎮 Mode jeu — Gameplay non activé (V1)
        </div>
      )}

      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Mobile back button */}
          {!mobileShowList && (
            <button className="md:hidden" onClick={() => { setMobileShowList(true); setSelectedPoiId(null); }}>
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="font-semibold">{title}</h1>
            <p className="text-xs text-muted-foreground">
              {project.city}
              {isVisit && ` · ${visitedIds.size}/${pois.length} vus`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View mode toggle */}
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              className="h-7 w-7 p-0"
              onClick={() => setViewMode('list')}
              title="Liste"
            >
              <List className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'map' ? 'default' : 'ghost'}
              className="h-7 w-7 p-0"
              onClick={() => setViewMode('map')}
              title="Carte"
            >
              <MapIcon className="w-3.5 h-3.5" />
            </Button>
          </div>
          {/* Visit: next recommended */}
          {isVisit && nextUnvisited && !selectedPoi && (
            <Button size="sm" variant="outline" onClick={() => selectPoi(nextUnvisited.id)} className="hidden md:flex">
              <ChevronRight className="w-4 h-4 mr-1" /> Suivant
            </Button>
          )}
          {remainingSeconds !== null && !isExpired && (
            <div className="flex items-center gap-2 text-sm font-mono">
              <Clock className="w-4 h-4" />
              <span className={remainingSeconds < 300 ? 'text-destructive font-bold' : ''}>{formatTime(remainingSeconds)}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── MAP MODE ──────────────────────────────────────── */}
        {viewMode === 'map' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 min-h-0">
              <Suspense fallback={
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <span className="animate-pulse">Chargement carte…</span>
                </div>
              }>
                <QuestMap
                  pois={pois}
                  selectedPoiId={selectedPoiId}
                  visitedIds={visitedIds}
                  coverUrls={coverUrls}
                  onSelectPOI={selectPoi}
                  onCheckin={handleCheckin}
                />
              </Suspense>
            </div>
          </div>
        )}

        {/* ── LIST MODE ─────────────────────────────────────── */}
        {viewMode === 'list' && (
          <>
            {/* Desktop sidebar */}
            <aside className="w-64 border-r bg-card overflow-y-auto shrink-0 hidden md:block">
              <POIList
                pois={pois}
                selectedPoiId={selectedPoiId}
                visitedIds={visitedIds}
                coverUrls={coverUrls}
                isVisit={isVisit}
                onSelect={selectPoi}
              />
            </aside>

            {/* Mobile: toggle list/detail */}
            <div className="md:hidden flex-1 flex flex-col overflow-hidden">
              {mobileShowList ? (
                <div className="flex-1 overflow-y-auto">
                  {isVisit && nextUnvisited && (
                    <div className="p-3 border-b">
                      <Button size="sm" className="w-full" onClick={() => selectPoi(nextUnvisited.id)}>
                        <ChevronRight className="w-4 h-4 mr-1" /> Suivant: {nextUnvisited.name}
                      </Button>
                    </div>
                  )}
                  <POIList
                    pois={pois}
                    selectedPoiId={selectedPoiId}
                    visitedIds={visitedIds}
                    coverUrls={coverUrls}
                    isVisit={isVisit}
                    onSelect={selectPoi}
                  />
                </div>
              ) : (
                <main className="flex-1 overflow-y-auto p-4">
                  {selectedPoi ? (
                    <POIDetail poi={selectedPoi} getMediaUrls={getMediaUrls} isVisit={isVisit} />
                  ) : (
                    <EmptyState />
                  )}
                </main>
              )}
            </div>

            {/* Desktop main */}
            <main className="flex-1 overflow-y-auto p-4 hidden md:block">
              {selectedPoi ? (
                <POIDetail poi={selectedPoi} getMediaUrls={getMediaUrls} isVisit={isVisit} />
              ) : (
                <EmptyState />
              )}
            </main>
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
      <MapPin className="w-10 h-10" />
      <p>Sélectionnez une étape</p>
    </div>
  );
}

/* ─── POI List ─── */
function POIList({
  pois, selectedPoiId, visitedIds, coverUrls, isVisit, onSelect,
}: {
  pois: PlayData['pois'];
  selectedPoiId: string | null;
  visitedIds: Set<string>;
  coverUrls: Record<string, string>;
  isVisit: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="p-2 space-y-1">
      {pois.map((poi, i) => {
        const media = poi.step_config?.media as Record<string, unknown> | undefined;
        const coverId = typeof media?.coverPhotoId === 'string' ? media.coverPhotoId : null;
        const coverUrl = coverId ? coverUrls[coverId] : null;
        const visited = visitedIds.has(poi.id);

        return (
          <button
            key={poi.id}
            onClick={() => onSelect(poi.id)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
              selectedPoiId === poi.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
            }`}
          >
            {/* Cover thumbnail */}
            {coverUrl ? (
              <img src={coverUrl} alt="" className="w-8 h-8 rounded object-cover shrink-0" />
            ) : (
              <div className="w-8 h-8 rounded bg-muted shrink-0 flex items-center justify-center text-xs text-muted-foreground">
                {i + 1}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="font-medium truncate block">{poi.name}</span>
              <span className="block text-xs opacity-70 truncate">{poi.zone} · {poi.interaction}</span>
            </div>
            {isVisit && visited && (
              <CheckCircle2 className="w-4 h-4 shrink-0 opacity-60" />
            )}
          </button>
        );
      })}
    </nav>
  );
}

/* ─── POI Detail ─── */
function POIDetail({
  poi,
  getMediaUrls,
  isVisit,
  accessToken,
  instanceId,
}: {
  poi: NonNullable<PlayData['pois'][number]>;
  getMediaUrls: (ids: string[]) => Promise<Record<string, string>>;
  isVisit: boolean;
  accessToken: string;
  instanceId: string;
}) {
  const config = poi.step_config || {};
  const geo = config.geo as Record<string, unknown> | undefined;
  const media = config.media as Record<string, unknown> | undefined;
  const contentI18n = config.contentI18n as Record<string, string> | undefined;
  const storyI18n = config.story_i18n as Record<string, string> | undefined;
  const metadataNote = (config as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
  const hints = config.hints as string[] | undefined;

  const [urls, setUrls] = useState<Record<string, string>>({});
  const [mediaLoading, setMediaLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const { priority, remaining } = useMemo(() => getPriorityMediaIds(poi), [poi]);
  const idsToLoad = showAll ? [...priority, ...remaining] : priority;

  // Fetch signed URLs (priority first, then all on demand)
  useEffect(() => {
    if (idsToLoad.length === 0) return;
    let cancelled = false;
    setMediaLoading(true);
    getMediaUrls(idsToLoad).then((result) => {
      if (!cancelled) {
        setUrls((prev) => ({ ...prev, ...result }));
        setMediaLoading(false);
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poi.id, showAll]);

  const photoIds = (media?.photoIds as string[] | undefined) || [];
  const audioIds = (media?.audioIds as string[] | undefined) || [];
  const videoIds = (media?.videoIds as string[] | undefined) || [];
  const coverPhotoId = media?.coverPhotoId as string | undefined;

  // Visit mode: extract best text
  const visitText = storyI18n?.fr || storyI18n?.en
    || contentI18n?.fr || contentI18n?.en
    || (typeof metadataNote?.note === 'string' ? metadataNote.note : null);

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-xl font-bold">{poi.name}</h2>
        <div className="flex gap-2 mt-1">
          <Badge variant="outline">{poi.interaction}</Badge>
          <Badge variant="outline">{poi.zone}</Badge>
        </div>
      </div>

      {/* Cover photo */}
      {coverPhotoId && urls[coverPhotoId] && (
        <img
          src={urls[coverPhotoId]}
          alt={`Cover ${poi.name}`}
          className="w-full rounded-lg max-h-64 object-cover"
        />
      )}

      {/* Visit mode: "À voir ici" */}
      {isVisit && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">📍 À voir ici</CardTitle>
          </CardHeader>
          <CardContent>
            {visitText ? (
              <p className="text-sm whitespace-pre-wrap">{visitText}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                Aucun texte, ajoute une note dans la bibliothèque.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Content / story (non-visit or additional) */}
      {!isVisit && contentI18n && Object.keys(contentI18n).length > 0 && (
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

      {/* Media */}
      {media && (priority.length + remaining.length) > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1">
              <Eye className="w-4 h-4" /> Médias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mediaLoading && <p className="text-xs text-muted-foreground animate-pulse">Chargement médias…</p>}

            {/* Photos */}
            {photoIds.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">📷 Photos ({photoIds.length})</p>
                <div className="grid grid-cols-3 gap-2">
                  {photoIds.map((id) =>
                    urls[id] ? (
                      <img key={id} src={urls[id]} alt="Photo" className="rounded w-full h-24 object-cover" />
                    ) : (
                      <div key={id} className="rounded bg-muted h-24 flex items-center justify-center text-xs text-muted-foreground">…</div>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Audio */}
            {audioIds.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">🔊 Audio ({audioIds.length})</p>
                <div className="space-y-1">
                  {audioIds.map((id) =>
                    urls[id] ? (
                      <audio key={id} controls src={urls[id]} className="w-full h-8" />
                    ) : (
                      <p key={id} className="text-xs text-muted-foreground">
                        {!showAll && remaining.includes(id) ? '—' : 'Chargement…'}
                      </p>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Video */}
            {videoIds.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1">🎬 Vidéo ({videoIds.length})</p>
                <div className="space-y-2">
                  {videoIds.map((id) =>
                    urls[id] ? (
                      <video key={id} controls src={urls[id]} className="w-full rounded max-h-48" />
                    ) : (
                      <p key={id} className="text-xs text-muted-foreground">
                        {!showAll && remaining.includes(id) ? '—' : 'Chargement…'}
                      </p>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Load all button */}
            {!showAll && remaining.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => setShowAll(true)}>
                +{remaining.length} médias restants — Charger tout
              </Button>
            )}
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
      {!contentI18n && !storyI18n && !geo && !media && !isVisit && (
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
