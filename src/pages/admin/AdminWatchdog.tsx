import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Loader2, RefreshCw, AlertTriangle, Info, AlertCircle, CheckCircle } from 'lucide-react';

interface WatchdogReport {
  id: string;
  created_at: string;
  report_type: string;
  severity: string;
  summary: string;
  details: Record<string, unknown>;
  resolved: boolean;
}

const severityConfig: Record<string, { icon: React.ElementType; color: string }> = {
  critical: { icon: AlertCircle, color: 'text-red-600' },
  warning: { icon: AlertTriangle, color: 'text-amber-500' },
  info: { icon: Info, color: 'text-blue-500' },
};

export default function AdminWatchdog() {
  const { toast } = useToast();
  const [reports, setReports] = useState<WatchdogReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState<Record<string, unknown> | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('watchdog_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setReports((data as unknown as WatchdogReport[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, []);

  const runWatchdog = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke('poi-watchdog');
      if (error) throw error;
      setStats(data?.stats ?? null);
      toast({ title: `Watchdog terminé — ${data?.alerts_count ?? 0} alertes` });
      await fetchReports();
    } catch (err: unknown) {
      toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const markResolved = async (id: string) => {
    await supabase.from('watchdog_reports').update({ resolved: true, resolved_at: new Date().toISOString() } as any).eq('id', id);
    setReports(prev => prev.map(r => r.id === id ? { ...r, resolved: true } : r));
  };

  const unresolved = reports.filter(r => !r.resolved);
  const resolved = reports.filter(r => r.resolved);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="font-semibold text-lg">Watchdog Qualité</h2>
          {unresolved.length > 0 && (
            <Badge variant="destructive" className="text-xs">{unresolved.length} alertes</Badge>
          )}
        </div>
        <Button onClick={runWatchdog} disabled={running} className="gap-2">
          {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Lancer l'analyse
        </Button>
      </div>

      {/* Stats summary */}
      {stats && (
        <Card className="p-4">
          <div className="grid grid-cols-4 md:grid-cols-8 gap-4 text-center text-sm">
            {Object.entries(stats).map(([key, val]) => (
              <div key={key}>
                <div className="font-bold text-lg text-foreground">{String(val)}</div>
                <div className="text-xs text-muted-foreground">{key.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Unresolved alerts */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Alertes actives ({unresolved.length})</h3>
        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-2">
            {loading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : unresolved.length === 0 ? (
              <Card className="p-4 text-center text-muted-foreground text-sm">
                <CheckCircle className="w-5 h-5 mx-auto mb-2 text-emerald-500" />
                Aucune alerte active
              </Card>
            ) : (
              unresolved.map(r => {
                const cfg = severityConfig[r.severity] ?? severityConfig.info;
                const Icon = cfg.icon;
                return (
                  <Card key={r.id} className="p-3 flex items-start gap-3">
                    <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${cfg.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">{r.report_type}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString('fr')}</span>
                      </div>
                      <p className="text-sm mt-1">{r.summary}</p>
                      {r.details && Object.keys(r.details).length > 0 && (
                        <details className="mt-1">
                          <summary className="text-xs text-muted-foreground cursor-pointer">Détails</summary>
                          <pre className="text-xs mt-1 bg-muted p-2 rounded overflow-auto max-h-32">{JSON.stringify(r.details, null, 2)}</pre>
                        </details>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" className="text-xs flex-shrink-0" onClick={() => markResolved(r.id)}>
                      Résolu
                    </Button>
                  </Card>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Resolved */}
      {resolved.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">Résolues ({resolved.length})</h3>
          <div className="space-y-1">
            {resolved.slice(0, 10).map(r => (
              <div key={r.id} className="text-xs text-muted-foreground flex items-center gap-2 py-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span className="flex-1 truncate">{r.summary}</span>
                <span>{new Date(r.created_at).toLocaleDateString('fr')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
