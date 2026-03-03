import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trash2, RefreshCw, ShoppingCart, Gamepad2, Clock, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface HealthStats {
  orders_24h: { pending: number; paid: number; total: number };
  instances_24h: { started: number; expired: number; pending: number; total: number };
  top_emails: { email: string; count: number }[];
}

export default function AdminHealth() {
  const [stats, setStats] = useState<HealthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleanupResult, setCleanupResult] = useState<any>(null);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const since = new Date(Date.now() - 86400_000).toISOString();

      const [ordersRes, instancesRes, emailsRes] = await Promise.all([
        supabase.from('orders').select('status').gte('created_at', since),
        supabase.from('quest_instances').select('status').gte('created_at', since),
        supabase.from('orders').select('customer_email').gte('created_at', since).not('customer_email', 'is', null),
      ]);

      const orders = ordersRes.data ?? [];
      const instances = instancesRes.data ?? [];
      const emails = emailsRes.data ?? [];

      // Count by status
      const ordersPending = orders.filter(o => o.status === 'pending').length;
      const ordersPaid = orders.filter(o => o.status === 'paid').length;

      const instStarted = instances.filter(i => i.status === 'started').length;
      const instExpired = instances.filter(i => i.status === 'expired').length;
      const instPending = instances.filter(i => i.status === 'pending').length;

      // Top 5 emails
      const emailCounts: Record<string, number> = {};
      for (const e of emails) {
        const addr = e.customer_email ?? '';
        if (addr) emailCounts[addr] = (emailCounts[addr] || 0) + 1;
      }
      const topEmails = Object.entries(emailCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([email, count]) => ({ email, count }));

      setStats({
        orders_24h: { pending: ordersPending, paid: ordersPaid, total: orders.length },
        instances_24h: { started: instStarted, expired: instExpired, pending: instPending, total: instances.length },
        top_emails: topEmails,
      });
    } catch (e) {
      console.error('Error fetching health stats:', e);
      toast.error('Erreur chargement des stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const runCleanup = async () => {
    setCleanupLoading(true);
    setCleanupResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Non authentifié');
        return;
      }

      const res = await supabase.functions.invoke('admin-run-cleanup', {
        method: 'POST',
        body: {},
      });

      if (res.error) {
        toast.error(`Cleanup échoué: ${res.error.message}`);
        return;
      }

      setCleanupResult(res.data?.result ?? res.data);
      toast.success('Cleanup terminé');
      fetchStats();
    } catch (e: any) {
      toast.error(`Erreur: ${e.message}`);
    } finally {
      setCleanupLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Santé système</h1>
          <p className="text-sm text-muted-foreground">Statistiques 24h + nettoyage</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Rafraîchir
        </Button>
      </div>

      {loading && !stats ? (
        <p className="text-muted-foreground">Chargement…</p>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Orders 24h */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Commandes (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.orders_24h.total}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">{stats.orders_24h.pending} pending</Badge>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{stats.orders_24h.paid} paid</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Instances 24h */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Gamepad2 className="w-4 h-4" />
                Instances (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stats.instances_24h.total}</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                <Badge variant="outline">{stats.instances_24h.pending} pending</Badge>
                <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">{stats.instances_24h.started} started</Badge>
                <Badge variant="secondary">{stats.instances_24h.expired} expired</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Top emails */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Top emails (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.top_emails.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune commande</p>
              ) : (
                <ul className="space-y-1">
                  {stats.top_emails.map((e, i) => (
                    <li key={i} className="flex justify-between text-sm">
                      <span className="truncate max-w-[180px]">{e.email}</span>
                      <Badge variant="outline">{e.count}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Cleanup section */}
      <Card className="border-destructive/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Nettoyage données expirées
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Supprime les instances expirées et commandes pending &gt; 7 jours. Synchronise les statuts d'expiration.
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={runCleanup}
            disabled={cleanupLoading}
          >
            <Trash2 className={`w-4 h-4 mr-2 ${cleanupLoading ? 'animate-spin' : ''}`} />
            {cleanupLoading ? 'En cours…' : 'Lancer le cleanup'}
          </Button>

          {cleanupResult && (
            <div className="p-3 bg-muted rounded-lg text-sm space-y-1">
              <p>✅ Instances sync → <strong>{cleanupResult.synced_instances ?? 0}</strong></p>
              <p>🗑️ Instances supprimées → <strong>{cleanupResult.deleted_instances ?? 0}</strong></p>
              <p>🗑️ Orders supprimées → <strong>{cleanupResult.deleted_orders ?? 0}</strong></p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
