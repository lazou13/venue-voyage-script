import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PhotoLightbox, LightboxPhoto } from '@/components/intake/shared/PhotoLightbox';
import { Download, Image, MapPin, Calendar, CheckSquare, Loader2, Trash2 } from 'lucide-react';
import JSZip from 'jszip';
import { useToast } from '@/hooks/use-toast';

interface PhotoItem {
  url: string;
  markerId: string;
  note: string | null;
  lat: number;
  lng: number;
  createdAt: string;
  traceName: string | null;
  projectId: string;
}

export default function AdminMediaLibrary() {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterTrace, setFilterTrace] = useState<string>('all');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: markers = [], isLoading } = useQuery({
    queryKey: ['media-library-markers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('route_markers')
        .select('id, lat, lng, note, photo_url, photo_urls, created_at, trace_id, route_traces!inner(name, project_id)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Flatten markers into individual photo items
  const photos = useMemo<PhotoItem[]>(() => {
    const items: PhotoItem[] = [];
    for (const m of markers) {
      const trace = m.route_traces as unknown as { name: string | null; project_id: string };
      const urls: string[] = [];
      if (m.photo_urls && Array.isArray(m.photo_urls) && m.photo_urls.length > 0) {
        urls.push(...m.photo_urls.filter(Boolean));
      } else if (m.photo_url) {
        urls.push(m.photo_url);
      }
      for (const url of urls) {
        items.push({
          url,
          markerId: m.id,
          note: m.note,
          lat: Number(m.lat),
          lng: Number(m.lng),
          createdAt: m.created_at,
          traceName: trace?.name || null,
          projectId: trace?.project_id || '',
        });
      }
    }
    return items;
  }, [markers]);

  // Unique traces for filter
  const traceOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of markers) {
      const trace = m.route_traces as unknown as { name: string | null };
      if (trace?.name) map.set(m.trace_id, trace.name);
    }
    return Array.from(map.entries());
  }, [markers]);

  const filtered = useMemo(() => {
    if (filterTrace === 'all') return photos;
    return photos.filter(p => {
      const m = markers.find(mk => mk.id === p.markerId);
      return m?.trace_id === filterTrace;
    });
  }, [photos, filterTrace, markers]);

  const toggleSelect = (url: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(p => p.url)));
    }
  };

  const downloadZip = async () => {
    const urls = Array.from(selectedIds);
    if (urls.length === 0) return;
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      await Promise.all(urls.map(async (url, i) => {
        const res = await fetch(url);
        const blob = await res.blob();
        const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
        zip.file(`photo_${i + 1}.${ext}`, blob);
      }));
      const content = await zip.generateAsync({ type: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(content);
      a.download = `mediatheque_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: `${urls.length} photos téléchargées` });
    } catch {
      toast({ title: 'Erreur de téléchargement', variant: 'destructive' });
    } finally {
      setIsDownloading(false);
    }
  };

  const lightboxPhotos: LightboxPhoto[] = filtered.map(p => ({
    url: p.url,
    note: p.note,
    lat: p.lat,
    lng: p.lng,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-foreground">Médiathèque</h2>
          <Badge variant="secondary">
            <Image className="w-3 h-3 mr-1" />
            {filtered.length} photos
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterTrace} onValueChange={setFilterTrace}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Toutes les traces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les traces</SelectItem>
              {traceOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={toggleAll}>
            <CheckSquare className="w-4 h-4 mr-1" />
            {selectedIds.size === filtered.length ? 'Désélectionner' : 'Tout sélectionner'}
          </Button>

          {selectedIds.size > 0 && (
            <Button size="sm" onClick={downloadZip} disabled={isDownloading}>
              {isDownloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
              Télécharger ({selectedIds.size})
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Aucune photo trouvée. Les photos apparaîtront ici après vos repérages terrain.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filtered.map((photo, i) => {
            const isSelected = selectedIds.has(photo.url);
            return (
              <Card
                key={`${photo.markerId}-${i}`}
                className={`group overflow-hidden cursor-pointer transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}
              >
                <div className="relative aspect-square">
                  <img
                    src={photo.url}
                    alt={photo.note || `Photo ${i + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onClick={() => { setLightboxIndex(i); setLightboxOpen(true); }}
                  />
                  <div className="absolute top-2 left-2" onClick={e => e.stopPropagation()}>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(photo.url)}
                      className="bg-background/80 backdrop-blur"
                    />
                  </div>
                </div>
                <CardContent className="p-2 space-y-1">
                  {photo.note && (
                    <p className="text-xs text-foreground line-clamp-1">{photo.note}</p>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-2.5 h-2.5" />
                      {photo.lat.toFixed(4)}, {photo.lng.toFixed(4)}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Calendar className="w-2.5 h-2.5" />
                      {new Date(photo.createdAt).toLocaleDateString('fr')}
                    </span>
                  </div>
                  {photo.traceName && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">
                      {photo.traceName}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <PhotoLightbox
        photos={lightboxPhotos}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />
    </div>
  );
}
