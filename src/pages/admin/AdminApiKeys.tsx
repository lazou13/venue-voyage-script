import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus, Copy, Trash2, Key } from "lucide-react";

function generateKey() {
  const chars = "abcdef0123456789";
  let rand = "";
  for (let i = 0; i < 24; i++) rand += chars[Math.floor(Math.random() * chars.length)];
  return `qr_live_custom_${rand}`;
}

export default function AdminApiKeys() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newAppName, setNewAppName] = useState("");
  const [newAppId, setNewAppId] = useState("");
  const [newRateLimit, setNewRateLimit] = useState(1000);

  const { data: keys = [], isLoading } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("api_keys")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Get today's usage per key
  const { data: usageMap = {} } = useQuery({
    queryKey: ["api-usage-today"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from("api_usage")
        .select("api_key_id, request_count")
        .gte("window_start", since);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        map[r.api_key_id] = (map[r.api_key_id] || 0) + r.request_count;
      });
      return map;
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("api_keys")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  const createKey = useMutation({
    mutationFn: async () => {
      const key = generateKey();
      const { error } = await (supabase as any)
        .from("api_keys")
        .insert({ key, app_name: newAppName, app_id: newAppId || null, rate_limit: newRateLimit });
      if (error) throw error;
      return key;
    },
    onSuccess: (key) => {
      qc.invalidateQueries({ queryKey: ["api-keys"] });
      setCreateOpen(false);
      setNewAppName("");
      setNewAppId("");
      setNewRateLimit(1000);
      navigator.clipboard.writeText(key);
      toast({ title: "Clé API créée", description: "Copiée dans le presse-papier" });
    },
  });

  const deleteKey = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("api_keys").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["api-keys"] }),
  });

  function usageBadge(keyId: string, limit: number) {
    const used = (usageMap as Record<string, number>)[keyId] || 0;
    const pct = limit > 0 ? (used / limit) * 100 : 0;
    const variant = pct > 90 ? "destructive" : pct > 70 ? "secondary" : "default";
    return <Badge variant={variant}>{used} / {limit}</Badge>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Key className="w-6 h-6" /> Clés API v2</h1>
          <p className="text-muted-foreground text-sm">Gestion des accès API pour les applications externes</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}><Plus className="w-4 h-4 mr-1" /> Nouvelle clé</Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Application</TableHead>
            <TableHead>Clé</TableHead>
            <TableHead>Usage 24h</TableHead>
            <TableHead>Requêtes totales</TableHead>
            <TableHead>Dernière utilisation</TableHead>
            <TableHead>Actif</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Chargement...</TableCell></TableRow>
          ) : keys.length === 0 ? (
            <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Aucune clé API</TableCell></TableRow>
          ) : keys.map((k: any) => (
            <TableRow key={k.id}>
              <TableCell>
                <div className="font-medium">{k.app_name}</div>
                {k.app_id && <div className="text-xs text-muted-foreground">{k.app_id}</div>}
              </TableCell>
              <TableCell>
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{k.key.slice(0, 16)}...</code>
                <Button variant="ghost" size="icon" className="ml-1 h-6 w-6" onClick={() => { navigator.clipboard.writeText(k.key); toast({ title: "Copié" }); }}>
                  <Copy className="w-3 h-3" />
                </Button>
              </TableCell>
              <TableCell>{usageBadge(k.id, k.rate_limit)}</TableCell>
              <TableCell>{k.requests_count?.toLocaleString() || 0}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {k.last_used_at ? new Date(k.last_used_at).toLocaleString("fr") : "Jamais"}
              </TableCell>
              <TableCell>
                <Switch checked={k.is_active} onCheckedChange={(v) => toggleActive.mutate({ id: k.id, is_active: v })} />
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" className="text-destructive" onClick={() => { if (confirm("Supprimer cette clé ?")) deleteKey.mutate(k.id); }}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Créer une clé API</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nom de l'application *</Label><Input value={newAppName} onChange={(e) => setNewAppName(e.target.value)} placeholder="Mon App" /></div>
            <div><Label>App ID (optionnel)</Label><Input value={newAppId} onChange={(e) => setNewAppId(e.target.value)} placeholder="Lovable project ID" /></div>
            <div><Label>Limite journalière</Label><Input type="number" value={newRateLimit} onChange={(e) => setNewRateLimit(parseInt(e.target.value) || 1000)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button disabled={!newAppName || createKey.isPending} onClick={() => createKey.mutate()}>Créer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
