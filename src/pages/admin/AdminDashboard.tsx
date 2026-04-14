import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, CheckCircle, AlertTriangle, Camera, Library, Image, MessageSquare, TrendingUp } from 'lucide-react';
import EnrichmentDrilldown from '@/components/admin/EnrichmentDrilldown';
import { useNavigate } from 'react-router-dom';

type DbField = 'history_context' | 'local_anecdote_fr' | 'local_anecdote_en' | 'fun_fact_fr' | 'fun_fact_en' | 'riddle_easy' | 'wikipedia_summary';

interface Stats {
  total: number;
  validated: number;
  enriched: number;
  draft: number;
  filtered: number;
  classified: number;
  withAnecdote: number;
  withAnecdoteEn: number;
  withRiddle: number;
  withPhoto: number;
  withWikipedia: number;
  withHistory: number;
  withFunFact: number;
  withFunFactEn: number;
  mediaCount: number;
  toursCount: number;
  clientPhotos: number;
  clientRecos: number;
  watchdogAlerts: number;
}

async function fetchStats(): Promise<Stats> {
  const [
    { count: total },
    { count: validated },
    { count: enriched },
    { count: draft },
    { count: filtered },
    { count: classified },
    { count: mediaCount },
    { count: toursCount },
    { count: clientPhotos },
    { count: clientRecos },
    { count: watchdogAlerts },
  ] = await Promise.all([
    supabase.from('medina_pois').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('medina_pois').select('id', { count: 'exact', head: true }).eq('status', 'validated'),
    supabase.from('medina_pois').select('id', { count: 'exact', head: true }).eq('status', 'enriched'),
    supabase.from('medina_pois').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    supabase.from('medina_pois').select('id', { count: 'exact', head: true }).eq('status', 'filtered'),
    supabase.from('medina_pois').select('id', { count: 'exact', head: true }).eq('status', 'classified'),
    supabase.from('poi_media').select('id', { count: 'exact', head: true }),
    supabase.from('quest_library').select('id', { count: 'exact', head: true }),
    supabase.from('quest_photos').select('id', { count: 'exact', head: true }),
    supabase.from('client_poi_recommendations').select('id', { count: 'exact', head: true }),
    supabase.from('watchdog_reports').select('id', { count: 'exact', head: true }).eq('resolved', false),
  ]);

  // Enrichment coverage — sample active POIs
  const { data: sample } = await supabase
    .from('medina_pois')
    .select('local_anecdote_fr, local_anecdote_en, riddle_easy, wikipedia_summary, history_context, fun_fact_fr, fun_fact_en')
    .eq('is_active', true)
    .limit(1000);

  const rows = sample ?? [];
  const withAnecdote = rows.filter((r: any) => r.local_anecdote_fr && r.local_anecdote_fr.length > 10).length;
  const withAnecdoteEn = rows.filter((r: any) => r.local_anecdote_en && r.local_anecdote_en.length > 10).length;
  const withRiddle = rows.filter((r: any) => r.riddle_easy && r.riddle_easy.length > 5).length;
  const withWikipedia = rows.filter((r: any) => r.wikipedia_summary && r.wikipedia_summary.length > 10).length;
  const withHistory = rows.filter((r: any) => r.history_context && r.history_context.length > 10).length;
  const withFunFact = rows.filter((r: any) => r.fun_fact_fr && r.fun_fact_fr.length > 5).length;
  const withFunFactEn = rows.filter((r: any) => r.fun_fact_en && r.fun_fact_en.length > 5).length;

  // Photos with media
  const withPhoto = mediaCount ?? 0;

  return {
    total: total ?? 0,
    validated: validated ?? 0,
    enriched: enriched ?? 0,
    draft: draft ?? 0,
    filtered: filtered ?? 0,
    classified: classified ?? 0,
    withAnecdote,
    withRiddle,
    withPhoto: withPhoto,
    withWikipedia,
    withHistory,
    withFunFact,
    mediaCount: mediaCount ?? 0,
    toursCount: toursCount ?? 0,
    clientPhotos: clientPhotos ?? 0,
    clientRecos: clientRecos ?? 0,
    watchdogAlerts: watchdogAlerts ?? 0,
  };
}

function Pct({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const color = pct >= 90 ? 'text-green-600' : pct >= 60 ? 'text-yellow-600' : 'text-red-600';
  return <span className={`font-bold ${color}`}>{pct}%</span>;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [drilldownField, setDrilldownField] = useState<DbField | null>(null);
  const [drilldownLabel, setDrilldownLabel] = useState('');
  const { data: stats, isLoading } = useQuery({
    queryKey: ['admin-dashboard-stats'],
    queryFn: fetchStats,
    refetchInterval: 60_000,
  });

  if (isLoading || !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const kpis = [
    { label: 'POIs actifs', value: stats.total, icon: MapPin, color: 'text-blue-600' },
    { label: 'Validés', value: stats.validated, icon: CheckCircle, color: 'text-green-600' },
    { label: 'Enrichis', value: stats.enriched, icon: TrendingUp, color: 'text-amber-600' },
    { label: 'Alertes Watchdog', value: stats.watchdogAlerts, icon: AlertTriangle, color: stats.watchdogAlerts > 0 ? 'text-red-600' : 'text-green-600' },
    { label: 'Photos POI', value: stats.mediaCount, icon: Image, color: 'text-purple-600' },
    { label: 'Visites générées', value: stats.toursCount, icon: Library, color: 'text-indigo-600' },
    { label: 'Photos clients', value: stats.clientPhotos, icon: Camera, color: 'text-pink-600' },
    { label: 'Recommandations', value: stats.clientRecos, icon: MessageSquare, color: 'text-teal-600' },
  ];

  const enrichmentCoverage: { label: string; value: number; total: number; field: DbField | 'photos' }[] = [
    { label: 'Histoires', value: stats.withHistory, total: stats.total, field: 'history_context' },
    { label: 'Anecdotes FR', value: stats.withAnecdote, total: stats.total, field: 'local_anecdote_fr' },
    { label: 'Fun Facts', value: stats.withFunFact, total: stats.total, field: 'fun_fact_fr' },
    { label: 'Énigmes', value: stats.withRiddle, total: stats.total, field: 'riddle_easy' },
    { label: 'Wikipedia', value: stats.withWikipedia, total: stats.total, field: 'wikipedia_summary' },
    { label: 'Photos', value: stats.withPhoto, total: stats.total, field: 'photos' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tableau de bord</h1>
        <p className="text-muted-foreground text-sm">Vue d'ensemble de la base POI Médina</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              <Icon className={`h-8 w-8 ${color}`} />
              <div>
                <p className="text-2xl font-bold">{value.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Répartition par statut</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Badge variant="default" className="text-sm px-3 py-1">
              ✅ Validés: {stats.validated}
            </Badge>
            <Badge variant="secondary" className="text-sm px-3 py-1">
              🔄 Enrichis: {stats.enriched}
            </Badge>
            <Badge variant="outline" className="text-sm px-3 py-1">
              📝 Brouillons: {stats.draft}
            </Badge>
            <Badge variant="outline" className="text-sm px-3 py-1">
              🏷️ Classifiés: {stats.classified}
            </Badge>
            <Badge variant="destructive" className="text-sm px-3 py-1">
              🚫 Filtrés: {stats.filtered}
            </Badge>
          </div>

          {/* Visual bar */}
          <div className="mt-4 h-6 rounded-full overflow-hidden flex bg-muted">
            {stats.validated > 0 && (
              <div className="bg-green-500 h-full" style={{ width: `${(stats.validated / stats.total) * 100}%` }} title={`Validés: ${stats.validated}`} />
            )}
            {stats.enriched > 0 && (
              <div className="bg-amber-500 h-full" style={{ width: `${(stats.enriched / stats.total) * 100}%` }} title={`Enrichis: ${stats.enriched}`} />
            )}
            {stats.classified > 0 && (
              <div className="bg-blue-400 h-full" style={{ width: `${(stats.classified / stats.total) * 100}%` }} title={`Classifiés: ${stats.classified}`} />
            )}
            {stats.draft > 0 && (
              <div className="bg-gray-400 h-full" style={{ width: `${(stats.draft / stats.total) * 100}%` }} title={`Brouillons: ${stats.draft}`} />
            )}
            {stats.filtered > 0 && (
              <div className="bg-red-400 h-full" style={{ width: `${(stats.filtered / stats.total) * 100}%` }} title={`Filtrés: ${stats.filtered}`} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Enrichment coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Couverture d'enrichissement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {enrichmentCoverage.map(({ label, value, total, field }) => (
              <div
                key={label}
                className="text-center p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted transition-colors hover:ring-1 hover:ring-primary/30"
                onClick={() => {
                  if (field === 'photos') {
                    navigate('/admin/media-library');
                  } else {
                    setDrilldownField(field);
                    setDrilldownLabel(label);
                  }
                }}
              >
                <p className="text-2xl font-bold"><Pct value={value} total={total} /></p>
                <p className="text-xs text-muted-foreground mt-1">{label}</p>
                <p className="text-xs text-muted-foreground">{value}/{total}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {drilldownField && (
        <EnrichmentDrilldown
          field={drilldownField}
          label={drilldownLabel}
          open={!!drilldownField}
          onOpenChange={(open) => { if (!open) setDrilldownField(null); }}
        />
      )}

      {/* Inter-project API status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API Inter-projets</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <div className="flex items-center justify-between">
            <span>POIs disponibles pour Quest Rides Pro</span>
            <Badge variant={stats.validated > 0 ? "default" : "destructive"}>
              {stats.validated > 0 ? `${stats.validated} POIs ✓` : "⚠️ Aucun POI validé"}
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Visites pré-générées</span>
            <Badge variant="secondary">{stats.toursCount} visites</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span>Endpoint santé</span>
            <Badge variant="outline">mode=health ✓</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
