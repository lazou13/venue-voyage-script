import { useState, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMedinaPOIs } from '@/hooks/useMedinaPOIs';
import { supabase } from '@/integrations/supabase/client';
import { generateMedinaItinerary } from '@/lib/generateMedinaItinerary';
import { type StartHub } from '@/hooks/useQuestEngine';
import { toast } from 'sonner';
import { Copy, Wand2, Loader2, ExternalLink, Check, Navigation, Sparkles, Camera, Upload, Trash2, RefreshCw } from 'lucide-react';
import QuestBuilder from '@/components/quest/QuestBuilder';
import QuestResultDisplay from '@/components/quest/QuestResult';
import { type QuestResult as QuestResultType } from '@/hooks/useQuestEngine';

const HUB_THEMES = ['museums', 'architecture', 'artisan', 'family', 'exploration'] as const;
const DURATION_MAP: Record<number, number> = { 60: 6, 90: 8, 120: 10 };
const VALIDATION_TYPES = [
  { value: 'gps', label: '📍 GPS' },
  { value: 'photo_place', label: '📷 Photo lieu' },
  { value: 'photo_object', label: '🔍 Photo objet' },
] as const;
type ValidationType = 'gps' | 'photo_place' | 'photo_object';
const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 Mo

/* ─── Trigger Dialog ──────────────────────────────── */
function TriggerDialog({
  poi,
  open,
  onOpenChange,
}: {
  poi: { id: string; name: string; step_config: Record<string, any> };
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const cfg = poi.step_config ?? {};
  const [validationType, setValidationType] = useState<ValidationType>(cfg.validation_type ?? 'gps');
  const [refImageUrl, setRefImageUrl] = useState<string | null>(cfg.reference_image_url ?? null);
  const [triggerVideoUrl, setTriggerVideoUrl] = useState<string | null>(cfg.trigger_video_url ?? null);
  const [note, setNote] = useState<string>(cfg.trigger_note ?? '');
  const [uploading, setUploading] = useState<'photo' | 'video' | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraFileRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const patchStepConfig = useCallback(async (patch: Record<string, any>) => {
    const merged = { ...cfg, ...patch };
    const { error } = await supabase.from('pois').update({ step_config: merged }).eq('id', poi.id);
    if (error) {
      toast.error('Erreur de sauvegarde', { description: error.message });
    }
  }, [cfg, poi.id]);

  /* ─ Validation type ─ */
  const handleValidationType = async (v: ValidationType) => {
    setValidationType(v);
    await patchStepConfig({ validation_type: v });
  };

  /* ─ Upload helper ─ */
  const uploadFile = async (
    file: Blob,
    path: string,
    patchFields: Record<string, any>,
    kind: 'photo' | 'video',
  ) => {
    setUploading(kind);
    try {
      const { error: upErr } = await supabase.storage
        .from('poi-media')
        .upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('poi-media').getPublicUrl(path);
      const url = urlData.publicUrl;
      await patchStepConfig(patchFields instanceof Function ? patchFields(url) : { ...patchFields });
      // We need the url in patchFields, so we use a callback pattern
      return url;
    } catch (err: any) {
      toast.error(`Erreur upload ${kind}`, { description: err.message });
      return null;
    } finally {
      setUploading(null);
    }
  };

  /* ─ Camera capture ─ */
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setShowCamera(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 100);
    } catch {
      // Fallback to file input
      cameraFileRef.current?.click();
    }
  };

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedBlob(blob);
        setCapturedPreview(URL.createObjectURL(blob));
      }
    }, 'image/jpeg', 0.85);
    stopCamera();
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
  };

  const useCapture = async () => {
    if (!capturedBlob) return;
    const path = `triggers/${poi.id}/reference.jpg`;
    const url = await uploadFile(capturedBlob, path, {}, 'photo');
    if (url) {
      await patchStepConfig({ reference_image_url: url, photo_reference_required: true });
      setRefImageUrl(url);
    }
    setCapturedBlob(null);
    setCapturedPreview(null);
  };

  const retakeCapture = () => {
    setCapturedBlob(null);
    setCapturedPreview(null);
    startCamera();
  };

  /* ─ File uploads ─ */
  const handlePhotoFile = async (file: File) => {
    const path = `triggers/${poi.id}/reference.jpg`;
    const url = await uploadFile(file, path, {}, 'photo');
    if (url) {
      await patchStepConfig({ reference_image_url: url, photo_reference_required: true });
      setRefImageUrl(url);
    }
  };

  const handleVideoFile = async (file: File) => {
    if (file.size > MAX_VIDEO_SIZE) {
      toast.error('Fichier trop volumineux', { description: 'Max 200 Mo' });
      return;
    }
    const ext = file.name.split('.').pop() || 'mp4';
    const path = `triggers/${poi.id}/video.${ext}`;
    const url = await uploadFile(file, path, {}, 'video');
    if (url) {
      await patchStepConfig({ trigger_video_url: url });
      setTriggerVideoUrl(url);
    }
  };

  const deleteVideo = async () => {
    await patchStepConfig({ trigger_video_url: null });
    setTriggerVideoUrl(null);
  };

  const handleNoteSave = async () => {
    await patchStepConfig({ trigger_note: note });
  };

  /* ─ Video drag & drop ─ */
  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) handleVideoFile(file);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) stopCamera(); onOpenChange(v); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">Déclencheur — {poi.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* BLOC A — Type de validation */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Type de validation</Label>
            <div className="flex gap-2">
              {VALIDATION_TYPES.map((vt) => (
                <button
                  key={vt.value}
                  onClick={() => handleValidationType(vt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                    validationType === vt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                  }`}
                >
                  {vt.label}
                </button>
              ))}
            </div>
          </div>

          {/* BLOC B — Photo de référence */}
          {validationType !== 'gps' && (
            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Photo que le joueur devra reproduire
              </Label>

              {showCamera && (
                <div className="space-y-2">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black aspect-video" />
                  <div className="flex justify-center">
                    <button
                      onClick={captureFrame}
                      className="w-14 h-14 rounded-full border-4 border-primary bg-background hover:bg-muted transition-colors"
                    />
                  </div>
                  <Button variant="ghost" size="sm" onClick={stopCamera} className="w-full">Annuler</Button>
                </div>
              )}

              {capturedPreview && (
                <div className="space-y-2">
                  <img src={capturedPreview} alt="Capture" className="w-40 rounded-lg border" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={useCapture} disabled={uploading === 'photo'}>
                      {uploading === 'photo' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                      Utiliser
                    </Button>
                    <Button variant="outline" size="sm" onClick={retakeCapture}>Reprendre</Button>
                  </div>
                </div>
              )}

              {!showCamera && !capturedPreview && !refImageUrl && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={startCamera}>
                    <Camera className="w-3.5 h-3.5 mr-1" /> Prendre une photo
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-3.5 h-3.5 mr-1" /> Uploader
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handlePhotoFile(e.target.files[0])}
                  />
                  <input
                    ref={cameraFileRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handlePhotoFile(e.target.files[0])}
                  />
                </div>
              )}

              {!showCamera && !capturedPreview && refImageUrl && (
                <div className="flex items-center gap-3">
                  <img src={refImageUrl} alt="Référence" className="w-40 h-auto rounded-lg border object-cover" />
                  <Button variant="outline" size="sm" onClick={() => { setRefImageUrl(null); }}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Changer
                  </Button>
                </div>
              )}

              {uploading === 'photo' && !capturedPreview && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Upload en cours…
                </div>
              )}
            </div>
          )}

          {/* BLOC C — Vidéo déclenchée */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Vidéo qui se lance quand le joueur valide
            </Label>
            <p className="text-xs text-muted-foreground">Remplace le QR code</p>

            {!triggerVideoUrl ? (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleVideoDrop}
                className="border-2 border-dashed border-border rounded-lg p-4 text-center space-y-2 hover:border-primary/50 transition-colors"
              >
                <p className="text-xs text-muted-foreground">Glisser une vidéo ou</p>
                <Button variant="outline" size="sm" onClick={() => videoInputRef.current?.click()} disabled={uploading === 'video'}>
                  {uploading === 'video' ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3.5 h-3.5 mr-1" />}
                  Choisir un fichier
                </Button>
                <p className="text-[10px] text-muted-foreground">Max 200 Mo · mp4, mov, webm</p>
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleVideoFile(e.target.files[0])}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <video controls src={triggerVideoUrl} className="w-full rounded-lg border max-h-40" />
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => videoInputRef.current?.click()}>
                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Remplacer
                  </Button>
                  <Button variant="destructive" size="sm" onClick={deleteVideo}>
                    <Trash2 className="w-3.5 h-3.5 mr-1" /> Supprimer
                  </Button>
                  <input
                    ref={videoInputRef}
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleVideoFile(e.target.files[0])}
                  />
                </div>
              </div>
            )}
          </div>

          {/* BLOC D — Note */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Note</Label>
            <Textarea
              rows={2}
              placeholder="Note terrain…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={handleNoteSave}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Status Badge ────────────────────────────────── */
function TriggerBadge({ stepConfig }: { stepConfig: Record<string, any> }) {
  const cfg = stepConfig ?? {};
  const vt = cfg.validation_type;
  const hasRef = !!cfg.reference_image_url;
  const hasVideo = !!cfg.trigger_video_url;

  if (hasRef && hasVideo) {
    return <Badge variant="outline" className="text-[10px] border-green-500 text-green-600 px-1.5 py-0">✓ déclencheur actif</Badge>;
  }
  if ((vt === 'photo_place' || vt === 'photo_object') && !hasVideo) {
    return <Badge variant="outline" className="text-[10px] border-orange-400 text-orange-500 px-1.5 py-0">📷 sans vidéo</Badge>;
  }
  return null;
}

/* ─── Main Page ───────────────────────────────────── */
export default function AdminMedinaCustomBuilder() {
  const { pois: medinaPois, isLoading: loadingPois } = useMedinaPOIs();

  // Form state
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [mode, setMode] = useState<'visit' | 'game'>('visit');
  const [duration, setDuration] = useState(60);
  const [zone, setZone] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [pause, setPause] = useState(false);
  const [hubTheme, setHubTheme] = useState('');
  const [startHub, setStartHub] = useState<StartHub | null>(null);
  // Generated state
  const [previewIds, setPreviewIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{ token: string; projectId: string } | null>(null);
  const [questResult, setQuestResult] = useState<QuestResultType | null>(null);
  const [showNewEngine, setShowNewEngine] = useState(false);
  // Trigger dialog
  const [triggerPoiId, setTriggerPoiId] = useState<string | null>(null);

  // Derived lists
  const zones = useMemo(() => [...new Set(medinaPois.filter(p => p.zone).map(p => p.zone))].sort(), [medinaPois]);
  const categories = useMemo(() => [...new Set(medinaPois.filter(p => p.category).map(p => p.category))].sort(), [medinaPois]);

  const previewPois = useMemo(
    () => previewIds.map(id => medinaPois.find(p => p.id === id)).filter(Boolean),
    [previewIds, medinaPois],
  );

  const count = DURATION_MAP[duration] ?? 6;

  const triggerPoi = useMemo(
    () => triggerPoiId ? medinaPois.find(p => p.id === triggerPoiId) : null,
    [triggerPoiId, medinaPois],
  );

  async function handleGenerate() {
    if (!zone) { toast.error('Sélectionnez une zone'); return; }

    let hub: StartHub | null = null;
    if (hubTheme) {
      const found = medinaPois.find(
        (p) => p.is_start_hub && p.is_active && p.hub_theme === hubTheme && p.lat != null && p.lng != null,
      );
      if (!found) {
        toast.error(`Aucun point de départ configuré pour le thème "${hubTheme}".`);
        return;
      }
      hub = { id: found.id, name: found.name, lat: found.lat!, lng: found.lng! };
    }
    setStartHub(hub);

    const ids = generateMedinaItinerary(medinaPois, {
      zone,
      categories: selectedCategories,
      pause,
      count,
      seed: customerEmail || String(Date.now()),
      startLat: hub?.lat,
      startLng: hub?.lng,
    });
    setPreviewIds(ids);
    setResult(null);
    if (ids.length < count) {
      toast.warning(`Seulement ${ids.length}/${count} POIs disponibles dans cette zone`);
    }
  }

  async function handleCreate() {
    if (!customerName.trim()) { toast.error('Nom du client requis'); return; }
    if (previewIds.length === 0) { toast.error('Générez d\'abord un itinéraire'); return; }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-custom-quest', {
        body: {
          customer_name: customerName,
          customer_email: customerEmail || undefined,
          experience_mode: mode,
          duration_minutes: duration,
          ttl_minutes: 240,
          medina_poi_ids: previewIds,
          hub_theme: hubTheme || undefined,
          start_point: startHub ? { name: startHub.name, lat: startHub.lat, lng: startHub.lng } : undefined,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setResult({ token: data.access_token, projectId: data.project_id });
      toast.success('Quête sur-mesure créée (1 appel) !');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  }

  function toggleCategory(cat: string) {
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat],
    );
  }

  const playUrl = result ? `${window.location.origin}/play?token=${result.token}` : '';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Sur-mesure Médina</h1>
        <p className="text-muted-foreground text-sm">Générer une quête personnalisée à partir de la bibliothèque Médina</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader><CardTitle className="text-base">Préférences client</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nom client *</Label>
                <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Jean Dupont" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="jean@example.com" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <Select value={mode} onValueChange={v => setMode(v as 'visit' | 'game')}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="visit">Visite</SelectItem>
                    <SelectItem value="game">Jeu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Durée</Label>
                <Select value={String(duration)} onValueChange={v => setDuration(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="60">60 min (6 POIs)</SelectItem>
                    <SelectItem value="90">90 min (8 POIs)</SelectItem>
                    <SelectItem value="120">120 min (10 POIs)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Zone</Label>
              <Select value={zone} onValueChange={setZone}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une zone" /></SelectTrigger>
                <SelectContent>
                  {zones.map(z => (
                    <SelectItem key={z} value={z}>{z}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Catégories (optionnel)</Label>
              <div className="flex flex-wrap gap-2">
                {categories.map(cat => (
                  <Badge
                    key={cat}
                    variant={selectedCategories.includes(cat) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleCategory(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox id="pause" checked={pause} onCheckedChange={v => setPause(v === true)} />
              <Label htmlFor="pause" className="cursor-pointer">Inclure une pause café/resto</Label>
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1"><Navigation className="w-3.5 h-3.5" /> Thème / Hub de départ</Label>
              <Select value={hubTheme || '__none__'} onValueChange={v => setHubTheme(v === '__none__' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Aucun (départ libre)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun (départ libre)</SelectItem>
                  {HUB_THEMES.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleGenerate} disabled={loadingPois || !zone} className="w-full">
              <Wand2 className="w-4 h-4 mr-2" /> Générer l'itinéraire ({count} POIs)
            </Button>

            {!showNewEngine && startHub && (
              <Card className="mt-4 border-dashed border-primary/40 bg-primary/5">
                <CardContent className="py-4 space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-primary" />
                    Nouveau moteur QuestEngine v3.0
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Génère chasse au trésor ET visite guidée depuis ce hub.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => { setShowNewEngine(true); setQuestResult(null); }}
                  >
                    Utiliser le nouveau moteur →
                  </Button>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        {/* Preview + Create */}
        <Card>
          <CardHeader><CardTitle className="text-base">Aperçu itinéraire</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {previewPois.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                Remplissez les préférences et cliquez "Générer"
              </p>
            ) : (
              <>
                {startHub && (
                  <div className="flex items-center gap-2 text-sm p-2 rounded bg-muted border border-border">
                    <Navigation className="w-4 h-4 text-amber-500" />
                    <span className="text-muted-foreground">Départ :</span>
                    <span className="font-medium">{startHub.name}</span>
                    <span className="text-xs text-muted-foreground">({startHub.lat.toFixed(4)}, {startHub.lng.toFixed(4)})</span>
                  </div>
                )}
                <div className="space-y-1">
                  {previewPois.map((poi, idx) => {
                    const sc = (poi as any)?.step_config ?? {};
                    return (
                      <div key={poi!.id} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted">
                        <span className="text-muted-foreground w-5 text-right">{idx + 1}.</span>
                        <span className="flex-1 font-medium">{poi!.name}</span>
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-xs">{poi!.category}</Badge>
                            <span className="text-xs text-muted-foreground">{poi!.zone}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={() => setTriggerPoiId(poi!.id)}
                            >
                              <Camera className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          <TriggerBadge stepConfig={sc} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!result && (
                  <Button onClick={handleCreate} disabled={creating || !customerName.trim()} className="w-full">
                    {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                    Créer projet + commande + instance
                  </Button>
                )}

                {result && (
                  <div className="space-y-3 p-3 rounded-lg bg-muted">
                    <p className="text-sm font-medium text-primary">✅ Quête créée avec succès !</p>
                    <div className="space-y-1">
                      <Label className="text-xs">Token d'accès</Label>
                      <div className="flex gap-2">
                        <Input value={result.token} readOnly className="font-mono text-xs" />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => { navigator.clipboard.writeText(result.token); toast.success('Token copié'); }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Lien joueur</Label>
                      <div className="flex gap-2">
                        <Input value={playUrl} readOnly className="text-xs" />
                        <Button
                          size="icon"
                          variant="outline"
                          onClick={() => { navigator.clipboard.writeText(playUrl); toast.success('Lien copié'); }}
                        >
                          <Copy className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="outline" asChild>
                          <a href={playUrl} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {showNewEngine && !questResult && (
        <Card className="mt-6">
          <CardContent className="py-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                QuestEngine v3.0
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowNewEngine(false)}>
                ← Retour ancien moteur
              </Button>
            </div>
            <QuestBuilder
              startLat={startHub?.lat ?? 0}
              startLng={startHub?.lng ?? 0}
              startName={startHub?.name}
              onQuestGenerated={(r) => setQuestResult(r)}
            />
          </CardContent>
        </Card>
      )}

      {showNewEngine && questResult && (
        <div className="mt-6">
          <QuestResultDisplay
            result={questResult}
            onRestart={() => setQuestResult(null)}
          />
        </div>
      )}

      {/* Trigger Dialog */}
      {triggerPoi && (
        <TriggerDialog
          poi={{ id: triggerPoi.id, name: triggerPoi.name, step_config: (triggerPoi as any).step_config ?? {} }}
          open={!!triggerPoiId}
          onOpenChange={(v) => { if (!v) setTriggerPoiId(null); }}
        />
      )}
    </div>
  );
}
