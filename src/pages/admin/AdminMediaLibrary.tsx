import { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { PhotoLightbox, LightboxPhoto } from '@/components/intake/shared/PhotoLightbox';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Download, Image, MapPin, Calendar, CheckSquare, Loader2, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PAGE_SIZE = 50;

interface PhotoItem {
  url: string;
  markerId: string;
  lat: number;
  lng: number;
  createdAt: string;
  traceName: string | null;
  projectId: string;
  projectName: string | null;
  note: string | null;
}

export default function AdminMediaLibrary() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterProject, setFilterProject] = useState<string>('all');
  const [filterTrace, setFilterTrace] = useState<string>('all');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [page, setPage] = useState(0);

  // Fetch projects for filter
  const { data: projects = [] } = useQuery({
    queryKey: ['media-library-projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, hotel_name')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Paginated markers query with server-side project filter
  const { data: markersResult, isLoading } = useQuery({
    queryKey: ['media-library-markers', filterProject, page],
    queryFn: async () => {
      let query = supabase
        .from('route_markers')
        .select('id, lat, lng, photo_url, photo_urls, created_at, trace_id, route_traces!inner(name, project_id, projects!inner(hotel_name))', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (filterProject !== 'all') {
        query = query.eq('route_traces.project_id', filterProject);
      }

      const from = page * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { markers: data || [], total: count || 0 };
    },
  });

  const markers = markersResult?.markers || [];
  const totalMarkers = markersResult?.total || 0;

  // Flatten markers into individual photo items
  const photos = useMemo<PhotoItem[]>(() => {
    const items: PhotoItem[] = [];
    for (const m of markers) {
      const trace = m.route_traces as unknown as { name: string | null; project_id: string; projects: { hotel_name: string } };
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
          note: null,
          lat: Number(m.lat),
          lng: Number(m.lng),
          createdAt: m.created_at,
          traceName: trace?.name || null,
          projectId: trace?.project_id || '',
          projectName: trace?.projects?.hotel_name || null,
        });
      }
    }
    return items;
  }, [markers]);

  // Unique traces for filter (from current page data)
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

  const totalPages = Math.max(1, Math.ceil(totalMarkers / PAGE_SIZE));

  const toggleSelect = useCallback((url: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url); else next.add(url);
      return next;
    });
  }, []);

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
      const { default: JSZip } = await import('jszip');
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

  const deleteSelected = async () => {
    const urls = Array.from(selectedIds);
    if (urls.length === 0) return;
    setIsDeleting(true);
    try {
      const byMarker = new Map<string, string[]>();
      for (const url of urls) {
        const photo = photos.find(p => p.url === url);
        if (!photo) continue;
        const existing = byMarker.get(photo.markerId) || [];
        existing.push(url);
        byMarker.set(photo.markerId, existing);
      }

      for (const [markerId, urlsToRemove] of byMarker) {
        const marker = markers.find(m => m.id === markerId);
        if (!marker) continue;
        const currentUrls: string[] = Array.isArray(marker.photo_urls) ? [...marker.photo_urls] : [];
        const newUrls = currentUrls.filter(u => !urlsToRemove.includes(u));
        const newPhotoUrl = urlsToRemove.includes(marker.photo_url || '') ? (newUrls[0] || null) : marker.photo_url;
        await supabase.from('route_markers').update({ photo_urls: newUrls, photo_url: newPhotoUrl }).eq('id', markerId);
      }

      const paths = urls.map(url => {
        try {
          const u = new URL(url);
          const match = u.pathname.match(/\/storage\/v1\/object\/public\/fieldwork\/(.+)/);
          return match?.[1] || null;
        } catch { return null; }
      }).filter(Boolean) as string[];
      if (paths.length > 0) await supabase.storage.from('fieldwork').remove(paths);

      await queryClient.invalidateQueries({ queryKey: ['media-library-markers'] });
      setSelectedIds(new Set());
      setShowDeleteDialog(false);
      toast({ title: `${urls.length} photo(s) supprimée(s)` });
    } catch {
      toast({ title: 'Erreur lors de la suppression', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  };

  const lightboxPhotos: LightboxPhoto[] = filtered.map(p => ({
    url: p.url,
    note: p.note,
    lat: p.lat,
    lng: p.lng,
  }));

  const handlePageChange = (newPage: number) => {
    if (newPage < 0 || newPage >= totalPages) return;
    setPage(newPage);
    setSelectedIds(new Set());
    setFilterTrace('all');
  };

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
            {totalMarkers} markers · {filtered.length} photos
          </Badge>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterProject} onValueChange={(v) => { setFilterProject(v); setPage(0); setFilterTrace('all'); }}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Tous les projets" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les projets</SelectItem>
              {projects.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.hotel_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

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
            <>
              <Button size="sm" onClick={downloadZip} disabled={isDownloading}>
                {isDownloading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
                Télécharger ({selectedIds.size})
              </Button>
              <Button size="sm" variant="destructive" onClick={() => setShowDeleteDialog(true)} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Trash2 className="w-4 h-4 mr-1" />}
                Supprimer ({selectedIds.size})
              </Button>
            </>
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
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
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
                  {(photo.traceName || photo.projectName) && (
                    <div className="flex items-center gap-1 flex-wrap">
                      {photo.projectName && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0">
                          {photo.projectName}
                        </Badge>
                      )}
                      {photo.traceName && (
                        <Badge variant="secondary" className="text-[10px] px-1 py-0">
                          {photo.traceName}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => handlePageChange(page - 1)}
                className={page === 0 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let p: number;
              if (totalPages <= 7) {
                p = i;
              } else if (page < 3) {
                p = i;
              } else if (page > totalPages - 4) {
                p = totalPages - 7 + i;
              } else {
                p = page - 3 + i;
              }
              return (
                <PaginationItem key={p}>
                  <PaginationLink
                    isActive={p === page}
                    onClick={() => handlePageChange(p)}
                    className="cursor-pointer"
                  >
                    {p + 1}
                  </PaginationLink>
                </PaginationItem>
              );
            })}
            <PaginationItem>
              <PaginationNext
                onClick={() => handlePageChange(page + 1)}
                className={page >= totalPages - 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <PhotoLightbox
        photos={lightboxPhotos}
        initialIndex={lightboxIndex}
        open={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {selectedIds.size} photo(s) ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Les fichiers seront supprimés définitivement du stockage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={deleteSelected} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
