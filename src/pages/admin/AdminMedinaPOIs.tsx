import { useState, useEffect, useRef, useCallback } from 'react';
import { useMedinaPOIs, type MedinaPOI } from '@/hooks/useMedinaPOIs';
import { usePOIMedia, type POIMedia } from '@/hooks/usePOIMedia';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus, Trash2, Image, Mic, Video, Star, Loader2, Upload, ExternalLink, MapPin, StickyNote,
} from 'lucide-react';

// ─── Role tags ──────────────────────────────────────────────
const ROLE_TAG_OPTIONS = ['repere', 'detail', 'instruction', 'ambiance'] as const;

function RoleTagChips({
  tags,
  onChange,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const toggle = (tag: string) => {
    onChange(tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag]);
  };
  return (
    <div className="flex flex-wrap gap-1">
      {ROLE_TAG_OPTIONS.map((tag) => (
        <button
          key={tag}
          type="button"
          onClick={() => toggle(tag)}
          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
            tags.includes(tag)
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-muted text-muted-foreground border-border hover:bg-accent'
          }`}
        >
          {tag}
        </button>
      ))}
    </div>
  );
}

// ─── POI List ───────────────────────────────────────────────
function POIListItem({
  poi,
  isSelected,
  onSelect,
}: {
  poi: MedinaPOI;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all ${
        isSelected
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'hover:bg-muted text-foreground'
      }`}
    >
      <div className="font-medium truncate">{poi.name}</div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-xs opacity-70">{poi.category}</span>
        {poi.zone && <span className="text-xs opacity-70">· {poi.zone}</span>}
        {!poi.is_active && (
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            inactif
          </Badge>
        )}
      </div>
    </button>
  );
}

// ─── Media Section ──────────────────────────────────────────
function MediaSection({
  medinaPoiId,
  mediaType,
  icon: Icon,
}: {
  medinaPoiId: string;
  mediaType: 'photo' | 'audio' | 'video';
  icon: React.ElementType;
}) {
  const { media, uploadMedia, setCover, removeMedia, updateMedia, getSignedUrl } = usePOIMedia(medinaPoiId);
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = media.filter((m) => m.media_type === mediaType);

  // Signed URL cache: only auto-load for photos
  const [urls, setUrls] = useState<Record<string, string>>({});

  const loadPhotoUrls = useCallback(async () => {
    if (mediaType !== 'photo') return; // Don't auto-sign audio/video
    const newUrls: Record<string, string> = {};
    for (const m of filtered) {
      if (!urls[m.id]) {
        try {
          newUrls[m.id] = await getSignedUrl(m.storage_path);
        } catch { /* skip */ }
      }
    }
    if (Object.keys(newUrls).length) setUrls((prev) => ({ ...prev, ...newUrls }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.map((m) => m.id).join(','), mediaType]);

  useEffect(() => { loadPhotoUrls(); }, [loadPhotoUrls]);

  // On-demand sign for audio/video
  const handleOpen = async (m: POIMedia) => {
    try {
      const url = await getSignedUrl(m.storage_path);
      window.open(url, '_blank');
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  const acceptMap: Record<string, string> = {
    photo: '.jpg,.jpeg,.png,.webp',
    audio: '.mp3,.m4a',
    video: '.mp4',
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files) {
      try {
        await uploadMedia.mutateAsync({ file, mediaType });
        toast({ title: `${mediaType} ajouté` });
      } catch (err: any) {
        toast({ title: 'Erreur upload', description: err.message, variant: 'destructive' });
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleRoleTagChange = (m: POIMedia, newTags: string[]) => {
    updateMedia.mutate({ id: m.id, role_tags: newTags });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploadMedia.isPending}>
          {uploadMedia.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Upload className="w-4 h-4 mr-1" />}
          Ajouter
        </Button>
        <input ref={inputRef} type="file" accept={acceptMap[mediaType]} multiple className="hidden" onChange={handleUpload} />
        <span className="text-xs text-muted-foreground">{filtered.length} fichier(s)</span>
      </div>

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground italic">Aucun {mediaType}</p>
      )}

      <div className="grid grid-cols-1 gap-2">
        {filtered.map((m) => {
          const extra = (m.extra ?? {}) as Record<string, unknown>;
          return (
            <div key={m.id} className="flex items-start gap-3 border rounded-lg p-2 bg-card">
              {/* Thumbnail / placeholder */}
              {mediaType === 'photo' && urls[m.id] ? (
                <img src={urls[m.id]} alt={m.caption ?? ''} className="w-16 h-16 object-cover rounded flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="w-6 h-6 text-muted-foreground" />
                </div>
              )}

              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs text-muted-foreground truncate">{m.storage_path.split('/').pop()}</p>
                <div className="flex gap-2 text-[10px] text-muted-foreground">
                  {m.size_bytes != null && <span>{(m.size_bytes / 1024).toFixed(0)} Ko</span>}
                  {extra.width && extra.height && <span>{String(extra.width)}×{String(extra.height)}</span>}
                  {(m.duration_sec ?? (extra.durationSec as number | undefined)) != null && (
                    <span>{String(m.duration_sec ?? extra.durationSec)}s</span>
                  )}
                </div>
                {m.is_cover && <Badge variant="secondary" className="text-[10px]">Cover</Badge>}
                <RoleTagChips tags={m.role_tags ?? []} onChange={(tags) => handleRoleTagChange(m, tags)} />
              </div>

              <div className="flex flex-col gap-1 flex-shrink-0">
                {mediaType === 'photo' && urls[m.id] ? (
                  <Button size="icon" variant="ghost" className="h-7 w-7" asChild>
                    <a href={urls[m.id]} target="_blank" rel="noreferrer"><ExternalLink className="w-3.5 h-3.5" /></a>
                  </Button>
                ) : mediaType !== 'photo' ? (
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleOpen(m)}>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                ) : null}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  title="Set cover"
                  disabled={m.is_cover || setCover.isPending}
                  onClick={() => setCover.mutate({ mediaId: m.id, mediaType, currentRoleTags: m.role_tags })}
                >
                  <Star className={`w-3.5 h-3.5 ${m.is_cover ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  disabled={removeMedia.isPending}
                  onClick={() => removeMedia.mutate(m)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── POI Editor Panel ───────────────────────────────────────
function POIEditorPanel({ poi, onUpdate, onDelete }: {
  poi: MedinaPOI;
  onUpdate: (id: string, data: Partial<MedinaPOI>) => void;
  onDelete: (id: string) => void;
}) {
  const [form, setForm] = useState(poi);
  const [geoLoading, setGeoLoading] = useState(false);
  const { toast } = useToast();
  useEffect(() => setForm(poi), [poi.id]);

  const set = (field: keyof MedinaPOI, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const setMeta = (key: string, value: unknown) =>
    setForm((prev) => ({
      ...prev,
      metadata: { ...prev.metadata, [key]: value },
    }));

  const save = () => {
    const { id, created_at, updated_at, ...rest } = form;
    onUpdate(poi.id, rest);
  };

  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Géolocalisation non disponible', variant: 'destructive' });
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((prev) => ({
          ...prev,
          lat: parseFloat(pos.coords.latitude.toFixed(6)),
          lng: parseFloat(pos.coords.longitude.toFixed(6)),
        }));
        setGeoLoading(false);
        // Auto-save after setting
        setTimeout(() => {
          onUpdate(poi.id, {
            lat: parseFloat(pos.coords.latitude.toFixed(6)),
            lng: parseFloat(pos.coords.longitude.toFixed(6)),
          });
        }, 0);
        toast({ title: 'Position capturée' });
      },
      (err) => {
        setGeoLoading(false);
        toast({ title: 'Erreur GPS', description: err.message, variant: 'destructive' });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const noteValue = (form.metadata as Record<string, unknown>)?.note as string ?? '';

  return (
    <div className="space-y-6">
      {/* Fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Nom</Label>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} onBlur={save} />
        </div>
        <div>
          <Label>Zone</Label>
          <Input value={form.zone} onChange={(e) => set('zone', e.target.value)} onBlur={save} />
        </div>
        <div>
          <Label>Catégorie</Label>
          <Input value={form.category} onChange={(e) => set('category', e.target.value)} onBlur={save} />
        </div>
        <div>
          <Label>Latitude</Label>
          <Input type="number" step="any" value={form.lat ?? ''} onChange={(e) => set('lat', e.target.value ? parseFloat(e.target.value) : null)} onBlur={save} />
        </div>
        <div>
          <Label>Longitude</Label>
          <Input type="number" step="any" value={form.lng ?? ''} onChange={(e) => set('lng', e.target.value ? parseFloat(e.target.value) : null)} onBlur={save} />
        </div>
        <div className="col-span-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleGeolocation}
            disabled={geoLoading}
          >
            {geoLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MapPin className="w-4 h-4 mr-1" />}
            Utiliser ma position
          </Button>
        </div>
        <div>
          <Label>Rayon (m)</Label>
          <Input type="number" value={form.radius_m} onChange={(e) => set('radius_m', parseInt(e.target.value) || 30)} onBlur={save} />
        </div>
        <div className="flex items-center gap-2 pt-5">
          <Switch checked={form.is_active} onCheckedChange={(v) => { set('is_active', v); setTimeout(save, 0); }} />
          <Label>Actif</Label>
        </div>
      </div>

      {/* Note / memo */}
      <div>
        <Label className="flex items-center gap-1 mb-1">
          <StickyNote className="w-3.5 h-3.5" /> Note
        </Label>
        <Textarea
          value={noteValue}
          placeholder="Mémo rapide sur ce POI..."
          rows={2}
          onChange={(e) => setMeta('note', e.target.value)}
          onBlur={save}
        />
      </div>

      <Separator />

      {/* Media tabs */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Médiathèque</h3>
        <Tabs defaultValue="photo">
          <TabsList>
            <TabsTrigger value="photo" className="gap-1"><Image className="w-3.5 h-3.5" /> Photos</TabsTrigger>
            <TabsTrigger value="audio" className="gap-1"><Mic className="w-3.5 h-3.5" /> Audio</TabsTrigger>
            <TabsTrigger value="video" className="gap-1"><Video className="w-3.5 h-3.5" /> Vidéo</TabsTrigger>
          </TabsList>
          <TabsContent value="photo">
            <MediaSection medinaPoiId={poi.id} mediaType="photo" icon={Image} />
          </TabsContent>
          <TabsContent value="audio">
            <MediaSection medinaPoiId={poi.id} mediaType="audio" icon={Mic} />
          </TabsContent>
          <TabsContent value="video">
            <MediaSection medinaPoiId={poi.id} mediaType="video" icon={Video} />
          </TabsContent>
        </Tabs>
      </div>

      <Separator />

      <Button variant="destructive" size="sm" onClick={() => onDelete(poi.id)}>
        <Trash2 className="w-4 h-4 mr-1" /> Supprimer ce POI
      </Button>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────
export default function AdminMedinaPOIs() {
  const { pois, isLoading, create, update, remove } = useMedinaPOIs();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedPOI = pois.find((p) => p.id === selectedId) ?? null;

  const handleCreate = async () => {
    try {
      const result = await create.mutateAsync({});
      setSelectedId(result.id);
      toast({ title: 'POI créé' });
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  const handleUpdate = async (id: string, data: Partial<MedinaPOI>) => {
    try {
      await update.mutateAsync({ id, ...data });
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      if (selectedId === id) setSelectedId(null);
      toast({ title: 'POI supprimé' });
    } catch (err: any) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Left: POI list */}
      <Card className="w-72 flex flex-col">
        <div className="p-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-sm">Bibliothèque Médina</h2>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCreate} disabled={create.isPending}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 p-2">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : pois.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun POI. Cliquez + pour commencer.</p>
          ) : (
            <div className="space-y-1">
              {pois.map((p) => (
                <POIListItem key={p.id} poi={p} isSelected={p.id === selectedId} onSelect={() => setSelectedId(p.id)} />
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Right: Editor */}
      <div className="flex-1 overflow-auto">
        {selectedPOI ? (
          <POIEditorPanel poi={selectedPOI} onUpdate={handleUpdate} onDelete={handleDelete} />
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <p>Sélectionnez un POI ou créez-en un nouveau</p>
          </div>
        )}
      </div>
    </div>
  );
}
