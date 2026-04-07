import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Camera, Star, CheckCircle2, XCircle, ArrowUpCircle, Eye } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type SourceFilter = 'all' | 'internal' | 'external';

function SourceBadge({ source }: { source: string | null }) {
  if (source) {
    return <Badge className="bg-blue-100 text-blue-800 text-[10px]">{source}</Badge>;
  }
  return <Badge variant="outline" className="text-[10px]">Interne</Badge>;
}

function SourceFilterSelect({ value, onChange }: { value: SourceFilter; onChange: (v: SourceFilter) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SourceFilter)}>
      <SelectTrigger className="w-[160px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Toutes sources</SelectItem>
        <SelectItem value="internal">Interne</SelectItem>
        <SelectItem value="external">Externe</SelectItem>
      </SelectContent>
    </Select>
  );
}

/* ─── Photos Tab ─── */
function PhotosTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<SourceFilter>('all');

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ['quest-photos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quest_photos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const filtered = photos.filter((p) => {
    if (filter === 'internal') return !p.source_project;
    if (filter === 'external') return !!p.source_project;
    return true;
  });

  const promote = useMutation({
    mutationFn: async (photo: typeof photos[0]) => {
      if (!photo.medina_poi_id) throw new Error('Pas de POI lié');
      const { error } = await supabase.from('poi_media').insert({
        medina_poi_id: photo.medina_poi_id,
        media_type: photo.media_type,
        storage_path: photo.storage_path,
        storage_bucket: photo.storage_bucket,
        caption: photo.caption,
        role_tags: JSON.parse(JSON.stringify(['client'])),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Photo promue dans poi_media ✓' });
      qc.invalidateQueries({ queryKey: ['quest-photos'] });
    },
    onError: (e) => toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' }),
  });

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const viewPhoto = async (path: string, bucket: string) => {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 300);
    if (data?.signedUrl) setPreviewUrl(data.signedUrl);
  };

  if (isLoading) return <p className="text-muted-foreground animate-pulse p-4">Chargement…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} photo(s)</p>
        <SourceFilterSelect value={filter} onChange={setFilter} />
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center" onClick={() => setPreviewUrl(null)}>
          <img src={previewUrl} alt="Preview" className="max-h-[80vh] max-w-[90vw] rounded-lg" />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {filtered.map((p) => (
          <Card key={p.id} className="overflow-hidden">
            <CardContent className="p-2 space-y-2">
              <div
                className="h-32 bg-muted rounded flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                onClick={() => viewPhoto(p.storage_path, p.storage_bucket)}
              >
                <Eye className="w-6 h-6 text-muted-foreground" />
              </div>
              <div className="text-xs space-y-1">
                <p className="truncate font-medium">{p.media_type} · {new Date(p.created_at).toLocaleDateString('fr')}</p>
                {p.caption && <p className="text-muted-foreground truncate">{p.caption}</p>}
                <div className="flex gap-1 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">
                    {p.medina_poi_id ? 'POI lié' : 'Général'}
                  </Badge>
                  <SourceBadge source={p.source_project} />
                </div>
              </div>
              {p.medina_poi_id && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs"
                  onClick={() => promote.mutate(p)}
                  disabled={promote.isPending}
                >
                  <ArrowUpCircle className="w-3 h-3 mr-1" /> Promouvoir
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Camera className="w-10 h-10 mx-auto mb-2" />
          <p>Aucune photo pour ce filtre</p>
        </div>
      )}
    </div>
  );
}

/* ─── Recommendations Tab ─── */
function RecommendationsTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<SourceFilter>('all');

  const { data: recs = [], isLoading } = useQuery({
    queryKey: ['client-recommendations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_poi_recommendations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const filtered = recs.filter((r) => {
    if (filter === 'internal') return !r.source_project;
    if (filter === 'external') return !!r.source_project;
    return true;
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('client_poi_recommendations')
        .update({ status, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Statut mis à jour ✓' });
      qc.invalidateQueries({ queryKey: ['client-recommendations'] });
    },
    onError: (e) => toast({ title: 'Erreur', description: (e as Error).message, variant: 'destructive' }),
  });

  if (isLoading) return <p className="text-muted-foreground animate-pulse p-4">Chargement…</p>;

  const statusColor = (s: string) =>
    s === 'approved' ? 'bg-green-100 text-green-800' :
    s === 'rejected' ? 'bg-red-100 text-red-800' :
    'bg-yellow-100 text-yellow-800';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} recommandation(s)</p>
        <SourceFilterSelect value={filter} onChange={setFilter} />
      </div>

      {filtered.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-4 flex items-start gap-4">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{r.poi_name || 'POI inconnu'}</span>
                <Badge className={statusColor(r.status)}>{r.status}</Badge>
                <SourceBadge source={r.source_project} />
              </div>
              {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
              <div className="flex gap-2 text-xs text-muted-foreground">
                {r.rating && <span>⭐ {r.rating}/5</span>}
                <span>{new Date(r.created_at).toLocaleDateString('fr')}</span>
                {r.medina_poi_id && <Badge variant="outline" className="text-[10px]">POI lié</Badge>}
              </div>
            </div>
            {r.status === 'pending' && (
              <div className="flex gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus.mutate({ id: r.id, status: 'approved' })}
                  disabled={updateStatus.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => updateStatus.mutate({ id: r.id, status: 'rejected' })}
                  disabled={updateStatus.isPending}
                >
                  <XCircle className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Star className="w-10 h-10 mx-auto mb-2" />
          <p>Aucune recommandation pour ce filtre</p>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function AdminClientFeedback() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Feedback Clients</h1>
        <p className="text-muted-foreground">Photos, vidéos et recommandations des joueurs</p>
      </div>

      <Tabs defaultValue="photos">
        <TabsList>
          <TabsTrigger value="photos" className="gap-1">
            <Camera className="w-4 h-4" /> Photos
          </TabsTrigger>
          <TabsTrigger value="recommendations" className="gap-1">
            <Star className="w-4 h-4" /> Recommandations
          </TabsTrigger>
        </TabsList>
        <TabsContent value="photos" className="mt-4">
          <PhotosTab />
        </TabsContent>
        <TabsContent value="recommendations" className="mt-4">
          <RecommendationsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
