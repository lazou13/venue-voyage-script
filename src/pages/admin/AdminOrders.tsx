import { useState } from "react";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrders } from '@/hooks/useOrders';
import { useQuestInstances } from '@/hooks/useQuestInstances';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Copy, Play, Trash2, ExternalLink, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  started: 'bg-green-100 text-green-800',
  completed: 'bg-blue-100 text-blue-800',
  expired: 'bg-red-100 text-red-800',
};

export default function AdminOrders() {
  const { ordersQuery, createOrder, deleteOrder } = useOrders();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const selectedOrder = ordersQuery.data?.find((o) => o.id === selectedOrderId);

  return (
    <div className="flex gap-6 h-full">
      {/* Left: Orders list */}
      <div className="w-80 shrink-0 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Commandes</h2>
          <Button size="sm" onClick={() => setShowNewForm(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nouvelle
          </Button>
        </div>

        {showNewForm && (
          <NewOrderForm
            onCreated={(id) => {
              setShowNewForm(false);
              setSelectedOrderId(id);
            }}
            onCancel={() => setShowNewForm(false)}
            createOrder={createOrder}
          />
        )}

        <div className="space-y-1">
          {ordersQuery.data?.map((order) => (
            <button
              key={order.id}
              onClick={() => setSelectedOrderId(order.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedOrderId === order.id
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              <div className="font-medium truncate">
                {order.customer_name || '(sans nom)'}
              </div>
              <div className="text-xs opacity-70">
                {order.experience_mode} · {format(new Date(order.created_at), 'dd/MM HH:mm')}
              </div>
            </button>
          ))}
          {ordersQuery.data?.length === 0 && (
            <p className="text-sm text-muted-foreground p-3">Aucune commande</p>
          )}
        </div>
      </div>

      {/* Right: Detail */}
      <div className="flex-1 min-w-0">
        {selectedOrder ? (
          <OrderDetail
            order={selectedOrder}
            onDelete={() => {
              deleteOrder.mutate(selectedOrder.id, {
                onSuccess: () => {
                  setSelectedOrderId(null);
                  toast.success('Commande supprimée');
                },
              });
            }}
          />
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            Sélectionnez une commande ou créez-en une
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── New Order Form ─── */
function NewOrderForm({
  onCreated,
  onCancel,
  createOrder,
}: {
  onCreated: (id: string) => void;
  onCancel: () => void;
  createOrder: ReturnType<typeof useOrders>['createOrder'];
}) {
  const [form, setForm] = useState({
    project_id: '',
    customer_name: '',
    customer_email: '',
    experience_mode: 'game',
    party_size: 2,
    locale: 'fr',
    notes: '',
  });

  const projectsQuery = useQuery({
    queryKey: ['projects-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, hotel_name, city')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = () => {
    if (!form.project_id) {
      toast.error('Sélectionnez un projet');
      return;
    }
    createOrder.mutate(
      {
        project_id: form.project_id,
        customer_name: form.customer_name,
        customer_email: form.customer_email || undefined,
        experience_mode: form.experience_mode,
        party_size: form.party_size,
        locale: form.locale,
        notes: form.notes || undefined,
      },
      {
        onSuccess: (data) => {
          toast.success('Commande créée');
          onCreated(data.id);
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  return (
    <Card>
      <CardContent className="p-3 space-y-2">
        <div>
          <Label className="text-xs">Projet</Label>
          <Select value={form.project_id} onValueChange={(v) => setForm((f) => ({ ...f, project_id: v }))}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Choisir..." />
            </SelectTrigger>
            <SelectContent>
              {projectsQuery.data?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.hotel_name} — {p.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Nom client</Label>
            <Input className="h-8 text-xs" value={form.customer_name} onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Email</Label>
            <Input className="h-8 text-xs" value={form.customer_email} onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label className="text-xs">Mode</Label>
            <Select value={form.experience_mode} onValueChange={(v) => setForm((f) => ({ ...f, experience_mode: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="game">Game</SelectItem>
                <SelectItem value="visit">Visit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Taille</Label>
            <Input className="h-8 text-xs" type="number" min={1} value={form.party_size} onChange={(e) => setForm((f) => ({ ...f, party_size: Number(e.target.value) }))} />
          </div>
          <div>
            <Label className="text-xs">Locale</Label>
            <Select value={form.locale} onValueChange={(v) => setForm((f) => ({ ...f, locale: v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fr">FR</SelectItem>
                <SelectItem value="en">EN</SelectItem>
                <SelectItem value="ar">AR</SelectItem>
                <SelectItem value="es">ES</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Notes</Label>
          <Textarea className="text-xs min-h-[40px]" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleSubmit} disabled={createOrder.isPending}>
            Créer
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Order Detail ─── */
function OrderDetail({ order, onDelete }: { order: NonNullable<ReturnType<typeof useOrders>['ordersQuery']['data']>[number]; onDelete: () => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">{order.customer_name || '(sans nom)'}</h3>
          <p className="text-sm text-muted-foreground">
            {order.customer_email} · {order.experience_mode} · {order.party_size} pers · {order.locale}
          </p>
        </div>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <Trash2 className="w-4 h-4 mr-1" /> Supprimer
        </Button>
      </div>

      {order.notes && (
        <p className="text-sm bg-muted rounded p-2">{order.notes}</p>
      )}

      <InstancesSection orderId={order.id} projectId={order.project_id} />
    </div>
  );
}

/* ─── Instances Section ─── */
function InstancesSection({ orderId, projectId }: { orderId: string; projectId: string }) {
  const { instancesQuery, createInstance, deleteInstance } = useQuestInstances(orderId);
  const [ttl, setTtl] = useState(240);
  const [startResult, setStartResult] = useState<Record<string, unknown> | null>(null);

  const handleCreate = () => {
    createInstance.mutate(
      { order_id: orderId, project_id: projectId, ttl_minutes: ttl },
      {
        onSuccess: () => toast.success('Instance créée'),
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const handleStart = async (accessToken: string) => {
    setStartResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('start-instance', {
        body: { access_token: accessToken },
      });
      if (error) throw error;
      setStartResult(data);
      toast.success('Instance démarrée');
      instancesQuery.refetch();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur';
      toast.error(msg);
      setStartResult({ error: msg });
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast.success('Token copié');
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Instances</CardTitle>
          <div className="flex items-center gap-2">
            <Label className="text-xs">TTL (min)</Label>
            <Input className="h-8 w-20 text-xs" type="number" value={ttl} onChange={(e) => setTtl(Number(e.target.value))} />
            <Button size="sm" onClick={handleCreate} disabled={createInstance.isPending}>
              <Plus className="w-4 h-4 mr-1" /> Créer
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {instancesQuery.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucune instance</p>
        )}
        {instancesQuery.data?.map((inst) => (
          <div key={inst.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={STATUS_COLORS[inst.status] || ''}>{inst.status}</Badge>
              <span className="text-xs text-muted-foreground">TTL {inst.ttl_minutes}min</span>
              {inst.starts_at && (
                <span className="text-xs text-muted-foreground">
                  Début: {format(new Date(inst.starts_at), 'dd/MM HH:mm')}
                </span>
              )}
              {inst.expires_at && (
                <span className="text-xs text-muted-foreground">
                  Fin: {format(new Date(inst.expires_at), 'dd/MM HH:mm')}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate font-mono">
                {inst.access_token}
              </code>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyToken(inst.access_token)}>
                <Copy className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="flex gap-1 flex-wrap">
              {inst.status === 'pending' && (
                <Button size="sm" variant="outline" onClick={() => handleStart(inst.access_token)}>
                  <Play className="w-3.5 h-3.5 mr-1" /> Start via API
                </Button>
              )}
              {inst.status === 'started' && (
                <Button size="sm" variant="outline" asChild>
                  <a href={`/play?token=${inst.access_token}`} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> Ouvrir player
                  </a>
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                onClick={() =>
                  deleteInstance.mutate(inst.id, {
                    onSuccess: () => toast.success('Instance supprimée'),
                  })
                }
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {startResult && (
          <pre className="text-xs bg-muted p-2 rounded overflow-auto max-h-60">
            {JSON.stringify(startResult, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}
