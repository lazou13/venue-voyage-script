import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { useMedinaPOIs, type MedinaPOI } from '@/hooks/useMedinaPOIs';
import { usePOIMedia, type POIMedia } from '@/hooks/usePOIMedia';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Plus, Trash2, Image, Mic, Video, Star, Loader2, Upload, ExternalLink, MapPin, StickyNote, Navigation, CheckCircle, RotateCcw, Map as MapIcon, List, ShieldCheck, AlertTriangle,
} from 'lucide-react';
import POIFeaturesSection, { type POIFeatures, emptyFeatures } from '@/components/admin/POIFeaturesSection';

// ─── Validation eligibility check ───────────────────────────
function isEligibleForValidation(poi: MedinaPOI): { eligible: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!poi.name?.trim()) reasons.push('Nom manquant');
  if (!poi.category?.trim()) reasons.push('Catégorie manquante');
  if (poi.lat == null || poi.lng == null) reasons.push('GPS manquant');
  const meta = poi.metadata as Record<string, unknown>;
  const sc = poi.step_config as Record<string, unknown>;
  // Check quality score if available
  const score = (poi as any).poi_quality_score;
  if (score != null && score < 3) reasons.push(`Score qualité trop bas (${score})`);
  return { eligible: reasons.length === 0, reasons };
}

// Lazy-load Leaflet map to avoid SSR/build issues
const MedinaMap = lazy(() => import('@/components/admin/MedinaMap'));

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
      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
        <span className="text-xs opacity-70">{poi.category}</span>
        {poi.zone && <span className="text-xs opacity-70">· {poi.zone}</span>}
        {poi.status === 'validated' ? (
          <Badge className="text-[10px] px-1.5 py-0 bg-emerald-600 text-white border-emerald-600">✓ Validé</Badge>
        ) : poi.status === 'enriched' ? (
          <Badge className="text-[10px] px-1.5 py-0 bg-blue-600 text-white border-blue-600">Enrichi</Badge>
        ) : poi.status === 'classified' ? (
          <Badge className="text-[10px] px-1.5 py-0 bg-violet-600 text-white border-violet-600">Classifié</Badge>
        ) : poi.status === 'filtered' ? (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">Filtré</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground border-border">Draft</Badge>
        )}
        {poi.is_start_hub && (
          <Badge className="text-[10px] px-1.5 py-0 bg-amber-500 text-white border-amber-500">
            <Navigation className="w-2.5 h-2.5 mr-0.5" /> HUB
          </Badge>
        )}
        {!poi.is_active && (
          <Badge variant="outline" className="text-[10px] px-1 py-0">inactif</Badge>
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
    } catch (err: unknown) {
      toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
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
      } catch (err: unknown) {
        toast({ title: 'Erreur upload', description: (err as Error).message, variant: 'destructive' });
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

  // Features: init from metadata.features or empty
  const meta = form.metadata as Record<string, unknown>;
  const features: POIFeatures = { ...emptyFeatures, ...(meta?.features as Partial<POIFeatures> ?? {}) };
  const setFeatures = (f: POIFeatures) => setMeta('features', f);

  const save = () => {
    if (form.is_start_hub && !form.hub_theme) return; // block save without theme
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
        toast({ title: 'Erreur GPS', description: (err as unknown as Error).message, variant: 'destructive' });
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

      {/* Start Hub */}
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="flex items-center gap-2">
          <Switch
            checked={form.is_start_hub}
            disabled={form.lat == null || form.lng == null}
            onCheckedChange={(v) => {
              set('is_start_hub', v);
              if (!v) set('hub_theme', null);
              setTimeout(save, 0);
            }}
          />
          <Label className="flex items-center gap-1">
            <Navigation className="w-3.5 h-3.5" /> Hub de départ
          </Label>
        </div>
        {(form.lat == null || form.lng == null) && (
          <p className="text-xs text-muted-foreground italic">Un hub nécessite des coordonnées GPS.</p>
        )}
        {form.is_start_hub && (
          <div>
            <Label>Thème associé</Label>
            <Select
              value={form.hub_theme ?? ''}
              onValueChange={(v) => { set('hub_theme', v); setTimeout(save, 0); }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choisir un thème…" />
              </SelectTrigger>
              <SelectContent>
                {['museums', 'architecture', 'artisan', 'family', 'exploration'].map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.is_start_hub && !form.hub_theme && (
              <p className="text-xs text-destructive mt-1">Le thème est obligatoire pour un hub.</p>
            )}
          </div>
        )}
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

      {/* Features */}
      <POIFeaturesSection features={features} onChange={setFeatures} onBlur={save} />

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

      {/* Validation workflow */}
      {(() => {
        const { eligible, reasons } = isEligibleForValidation(form);
        const isValidated = form.status === 'validated';

        return (
          <div className="space-y-2">
            {!isValidated ? (
              <>
                <Button
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={!eligible}
                  onClick={() => { onUpdate(poi.id, { status: 'validated' }); }}
                >
                  <CheckCircle className="w-4 h-4 mr-1" /> Valider ce POI
                </Button>
                {!eligible && (
                  <div className="text-xs text-destructive space-y-0.5">
                    {reasons.map((r, i) => <p key={i}>• {r}</p>)}
                  </div>
                )}
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={() => { onUpdate(poi.id, { status: 'draft' }); }}>
                <RotateCcw className="w-4 h-4 mr-1" /> Repasser en brouillon
              </Button>
            )}
          </div>
        );
      })()}

      <Separator />

      <Button variant="destructive" size="sm" onClick={() => onDelete(poi.id)}>
        <Trash2 className="w-4 h-4 mr-1" /> Supprimer ce POI
      </Button>
    </div>
  );
}

// ─── Stats bar ──────────────────────────────────────────────
function StatsBar({ pois }: { pois: MedinaPOI[] }) {
  const validated = pois.filter(p => p.status === 'validated').length;
  const enriched = pois.filter(p => p.status === 'enriched').length;
  const draft = pois.filter(p => p.status === 'draft').length;
  const classified = pois.filter(p => p.status === 'classified').length;
  const filtered = pois.filter(p => p.status === 'filtered').length;
  const hubs = pois.filter(p => p.is_start_hub).length;
  return (
    <div className="flex gap-4 text-xs text-muted-foreground px-1 pb-2 flex-wrap">
      <span><strong className="text-foreground">{pois.length}</strong> total</span>
      <span><strong className="text-emerald-600">{validated}</strong> validés</span>
      <span><strong className="text-blue-600">{enriched}</strong> enrichis</span>
      <span><strong className="text-violet-600">{classified}</strong> classifiés</span>
      <span><strong className="text-foreground">{draft}</strong> drafts</span>
      <span className="opacity-60">{filtered} filtrés</span>
      <span><strong className="text-amber-500">{hubs}</strong> hubs</span>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────
export default function AdminMedinaPOIs() {
  const { pois, isLoading, create, update, remove } = useMedinaPOIs();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [placeMode, setPlaceMode] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [bulkValidating, setBulkValidating] = useState(false);

  const selectedPOI = pois.find((p) => p.id === selectedId) ?? null;

  const filteredPois = pois.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return p.name.toLowerCase().includes(s) ||
      (p.zone && p.zone.toLowerCase().includes(s)) ||
      (p.category && p.category.toLowerCase().includes(s));
  });

  // Bulk validation: validate all eligible non-validated POIs
  const eligibleForBulk = pois.filter(p => p.status !== 'validated' && p.status !== 'filtered' && isEligibleForValidation(p).eligible);

  const handleBulkValidate = async () => {
    if (eligibleForBulk.length === 0) return;
    setBulkValidating(true);
    try {
      const ids = eligibleForBulk.map(p => p.id);
      const { error } = await supabase
        .from('medina_pois')
        .update({ status: 'validated', validated_at: new Date().toISOString() } as any)
        .in('id', ids);
      if (error) throw error;
      toast({ title: `${ids.length} POIs validés !` });
      // Refresh
      window.location.reload();
    } catch (err: unknown) {
      toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setBulkValidating(false);
    }
  };

  const handleCreate = async () => {
    try {
      const result = await create.mutateAsync({});
      setSelectedId(result.id);
      toast({ title: 'POI créé' });
    } catch (err: unknown) {
      toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleUpdate = async (id: string, data: Partial<MedinaPOI>) => {
    try {
      // Add validated_at timestamp when validating
      const payload = { ...data } as any;
      if (data.status === 'validated') payload.validated_at = new Date().toISOString();
      if (data.status === 'draft') payload.validated_at = null;
      await update.mutateAsync({ id, ...payload });
      if (data.status === 'validated') {
        toast({ title: 'POI validé — utilisable dans le moteur.' });
      } else if (data.status === 'draft') {
        toast({ title: 'POI repassé en brouillon.' });
      }
    } catch (err: unknown) {
      toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await remove.mutateAsync(id);
      if (selectedId === id) setSelectedId(null);
      toast({ title: 'POI supprimé' });
    } catch (err: unknown) {
      toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
    }
  };

  const handleMapClick = useCallback(async (lat: number, lng: number) => {
    if (!placeMode || !selectedId) return;
    await handleUpdate(selectedId, { lat, lng });
    setPlaceMode(false);
    toast({ title: 'Position enregistrée', description: `${lat.toFixed(5)}, ${lng.toFixed(5)}` });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeMode, selectedId]);

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] gap-3">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-semibold text-sm shrink-0">Bibliothèque Médina</h2>
        <Input
          placeholder="Rechercher POI, zone, catégorie..."
          className="h-8 text-sm max-w-xs"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous statuts</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="classified">Classifié</SelectItem>
            <SelectItem value="enriched">Enrichi</SelectItem>
            <SelectItem value="validated">Validé</SelectItem>
            <SelectItem value="filtered">Filtré</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1 ml-auto">
          {eligibleForBulk.length > 0 && (
            <Button
              size="sm"
              className="h-8 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleBulkValidate}
              disabled={bulkValidating}
            >
              {bulkValidating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
              Valider {eligibleForBulk.length} éligibles
            </Button>
          )}
          <Button
            size="sm"
            variant={viewMode === 'list' ? 'default' : 'outline'}
            className="h-8 gap-1"
            onClick={() => setViewMode('list')}
          >
            <List className="w-3.5 h-3.5" /> Liste
          </Button>
          <Button
            size="sm"
            variant={viewMode === 'map' ? 'default' : 'outline'}
            className="h-8 gap-1"
            onClick={() => setViewMode('map')}
          >
            <MapIcon className="w-3.5 h-3.5" /> Carte
          </Button>
          <Button size="sm" className="h-8 gap-1" onClick={handleCreate} disabled={create.isPending}>
            <Plus className="w-3.5 h-3.5" /> Nouveau POI
          </Button>
        </div>
      </div>

      <StatsBar pois={pois} />

      {/* Main layout */}
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Left: List or Map */}
        <div className={`flex flex-col ${selectedPOI ? 'w-[55%]' : 'flex-1'} min-h-0`}>
          {viewMode === 'list' ? (
            <Card className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1 p-2">
                {isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredPois.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {search ? 'Aucun résultat' : 'Aucun POI. Cliquez "Nouveau POI".'}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {filteredPois.map((p) => (
                      <POIListItem
                        key={p.id}
                        poi={p}
                        isSelected={p.id === selectedId}
                        onSelect={() => setSelectedId(p.id)}
                      />
                    ))}
                  </div>
                )}
              </ScrollArea>
            </Card>
          ) : (
            <div className="flex-1 min-h-0">
              <Suspense fallback={
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" /> Chargement carte…
                </div>
              }>
                <MedinaMap
                  pois={filteredPois.filter(p => p.lat != null && p.lng != null)}
                  selectedId={selectedId}
                  onSelectPOI={(id) => { setSelectedId(id); }}
                  onMapClick={handleMapClick}
                  placeMode={placeMode}
                />
              </Suspense>
            </div>
          )}
        </div>

        {/* Right: Editor */}
        {selectedPOI && (
          <Card className="flex-1 min-h-0 overflow-auto">
            <div className="p-4 space-y-1 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm truncate">{selectedPOI.name}</h3>
                <p className="text-xs text-muted-foreground">{selectedPOI.category} · {selectedPOI.zone}</p>
              </div>
              {viewMode === 'map' && (
                <Button
                  size="sm"
                  variant={placeMode ? 'default' : 'outline'}
                  className={`h-7 gap-1 text-xs ${placeMode ? 'bg-amber-500 hover:bg-amber-600' : ''}`}
                  onClick={() => setPlaceMode(v => !v)}
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {placeMode ? 'Annuler placement' : 'Placer sur carte'}
                </Button>
              )}
            </div>
            <ScrollArea className="h-[calc(100%-4rem)]">
              <div className="p-4">
                <POIEditorPanel poi={selectedPOI} onUpdate={handleUpdate} onDelete={handleDelete} />
              </div>
            </ScrollArea>
          </Card>
        )}

        {!selectedPOI && viewMode === 'list' && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground border border-dashed border-border rounded-lg">
            <p className="text-sm">Sélectionnez un POI pour l'éditer</p>
          </div>
        )}
      </div>
    </div>
  );
}
