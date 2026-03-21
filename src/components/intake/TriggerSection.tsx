import { useState, useRef, useCallback } from 'react';
import { Camera, Upload, Trash2, Replace, Video } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import type { StepConfig } from '@/types/intake';

type TriggerValidationType = 'gps' | 'photo_place' | 'photo_object';

interface TriggerSectionProps {
  poiId: string;
  config: StepConfig;
  onUpdateConfig: (updates: Partial<StepConfig>) => void;
}

const VALIDATION_PILLS: { value: TriggerValidationType; label: string }[] = [
  { value: 'gps', label: '📍 GPS uniquement' },
  { value: 'photo_place', label: '📷 Photo de lieu' },
  { value: 'photo_object', label: '🔍 Photo d\'objet' },
];

const MAX_VIDEO_SIZE = 200 * 1024 * 1024; // 200 MB
const ACCEPTED_VIDEO = '.mp4,.mov,.webm,video/mp4,video/quicktime,video/webm';

export function TriggerSection({ poiId, config, onUpdateConfig }: TriggerSectionProps) {
  const { toast } = useToast();
  const validationType = ((config as any).validation_type as TriggerValidationType) ?? 'gps';
  const referenceImageUrl = (config as any).reference_image_url as string | null ?? null;
  const triggerVideoUrl = (config as any).trigger_video_url as string | null ?? null;
  const triggerNote = ((config as any).trigger_note as string) ?? '';

  const [uploading, setUploading] = useState<'photo' | 'video' | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraFileRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // Fresh-read patch: read current step_config from DB, merge, save
  const freshPatch = useCallback(async (patch: Record<string, unknown>) => {
    const { data } = await supabase
      .from('pois')
      .select('step_config')
      .eq('id', poiId)
      .single();
    const current = (data?.step_config as Record<string, unknown>) ?? {};
    const merged = { ...current, ...patch };
    onUpdateConfig(merged as Partial<StepConfig>);
  }, [poiId, onUpdateConfig]);

  // Upload helper
  const uploadFile = async (file: Blob, path: string, kind: 'photo' | 'video'): Promise<string | null> => {
    setUploading(kind);
    setUploadProgress(10);
    try {
      const { error } = await supabase.storage
        .from('poi-media')
        .upload(path, file, { upsert: true });
      if (error) throw error;
      setUploadProgress(90);
      const { data: urlData } = supabase.storage.from('poi-media').getPublicUrl(path);
      setUploadProgress(100);
      return urlData.publicUrl;
    } catch (err: any) {
      toast({ title: `Erreur upload ${kind}`, description: err.message, variant: 'destructive' });
      return null;
    } finally {
      setTimeout(() => { setUploading(null); setUploadProgress(0); }, 300);
    }
  };

  // Camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setShowCamera(true);
    } catch {
      cameraFileRef.current?.click();
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
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

  const handleUseCapture = async () => {
    if (!capturedBlob) return;
    const url = await uploadFile(capturedBlob, `triggers/${poiId}/reference.jpg`, 'photo');
    if (url) {
      await freshPatch({ reference_image_url: url, photo_reference_required: true });
    }
    setCapturedBlob(null);
    setCapturedPreview(null);
  };

  const handlePhotoFile = async (file: File) => {
    const url = await uploadFile(file, `triggers/${poiId}/reference.jpg`, 'photo');
    if (url) {
      await freshPatch({ reference_image_url: url, photo_reference_required: true });
    }
  };

  const handleVideoFile = async (file: File) => {
    if (file.size > MAX_VIDEO_SIZE) {
      toast({ title: 'Fichier trop volumineux', description: 'Maximum 200 Mo', variant: 'destructive' });
      return;
    }
    const ext = file.name.split('.').pop() || 'mp4';
    const url = await uploadFile(file, `triggers/${poiId}/video.${ext}`, 'video');
    if (url) {
      await freshPatch({ trigger_video_url: url });
    }
  };

  const deleteVideo = async () => {
    await supabase.storage.from('poi-media').remove([`triggers/${poiId}/video.mp4`]);
    await freshPatch({ trigger_video_url: null });
  };

  return (
    <>
      <Separator />
      <div className="space-y-4">
        <p className="text-sm font-semibold">Déclencheur visuel 📷</p>

        {/* BLOC 1 — Validation type pills */}
        <div className="space-y-1.5">
          <Label className="text-sm">Type de validation</Label>
          <div className="flex flex-wrap gap-2">
            {VALIDATION_PILLS.map((pill) => (
              <button
                key={pill.value}
                type="button"
                onClick={() => freshPatch({ validation_type: pill.value })}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  validationType === pill.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted text-muted-foreground border-border hover:bg-accent'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>
        </div>

        {/* BLOC 2 — Photo de référence (hidden if GPS) */}
        {validationType !== 'gps' && (
          <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
            <Label className="text-sm">Photo que le joueur devra reproduire</Label>

            {/* Camera viewfinder */}
            {showCamera && (
              <div className="space-y-2">
                <video ref={videoRef} autoPlay playsInline muted className="w-full rounded-lg bg-black aspect-video" />
                <div className="flex justify-center gap-2">
                  <Button size="sm" onClick={capturePhoto} className="rounded-full w-12 h-12">⏺</Button>
                  <Button size="sm" variant="ghost" onClick={stopCamera}>Annuler</Button>
                </div>
              </div>
            )}

            {/* Capture preview */}
            {capturedPreview && (
              <div className="space-y-2">
                <img src={capturedPreview} alt="Capture" className="w-40 rounded-lg" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleUseCapture} disabled={uploading === 'photo'}>
                    {uploading === 'photo' ? 'Upload...' : 'Utiliser'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { setCapturedBlob(null); setCapturedPreview(null); startCamera(); }}>
                    Reprendre
                  </Button>
                </div>
              </div>
            )}

            {/* Show existing or upload buttons */}
            {!showCamera && !capturedPreview && (
              <>
                {referenceImageUrl ? (
                  <div className="space-y-2">
                    <img src={referenceImageUrl} alt="Référence" className="w-40 rounded-lg border" />
                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      Changer
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={startCamera} disabled={!!uploading}>
                      <Camera className="w-4 h-4 mr-1" /> Caméra
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={!!uploading}>
                      <Upload className="w-4 h-4 mr-1" /> Uploader
                    </Button>
                  </div>
                )}
              </>
            )}

            {uploading === 'photo' && <Progress value={uploadProgress} className="h-1" />}

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f); e.target.value = ''; }} />
            <input ref={cameraFileRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoFile(f); e.target.value = ''; }} />
          </div>
        )}

        {/* BLOC 3 — Vidéo déclenchée */}
        <div className="space-y-2 p-3 border rounded-lg bg-muted/30">
          <Label className="text-sm">Vidéo déclenchée quand le joueur valide ce stop</Label>
          <p className="text-xs text-muted-foreground">Même effet qu'un QR code</p>

          {triggerVideoUrl ? (
            <div className="space-y-2">
              <video src={triggerVideoUrl} controls className="w-full rounded-lg" />
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={deleteVideo}>
                  <Trash2 className="w-4 h-4 mr-1" /> Supprimer
                </Button>
                <Button size="sm" variant="outline" onClick={() => videoInputRef.current?.click()}>
                  <Replace className="w-4 h-4 mr-1" /> Remplacer
                </Button>
              </div>
            </div>
          ) : (
            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-border'
              }`}
              onClick={() => videoInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleVideoFile(f);
              }}
            >
              <Video className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Glisser une vidéo ou cliquer</p>
              <p className="text-xs text-muted-foreground mt-1">Max 200 Mo · mp4/mov/webm</p>
            </div>
          )}

          {uploading === 'video' && <Progress value={uploadProgress} className="h-1" />}

          <input ref={videoInputRef} type="file" accept={ACCEPTED_VIDEO} className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleVideoFile(f); e.target.value = ''; }} />
        </div>

        {/* BLOC 4 — Note terrain */}
        <div className="space-y-1.5">
          <Label className="text-sm">Note terrain</Label>
          <Textarea
            placeholder="Note terrain..."
            rows={2}
            defaultValue={triggerNote}
            onBlur={(e) => freshPatch({ trigger_note: e.target.value })}
          />
        </div>
      </div>
    </>
  );
}

// Micro-badge for header
export function TriggerStatusBadge({ config }: { config: StepConfig }) {
  const vt = (config as any).validation_type as string | undefined;
  const hasRef = !!(config as any).reference_image_url;
  const hasVideo = !!(config as any).trigger_video_url;

  if (!vt || vt === 'gps') return null;

  if (hasRef && hasVideo) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
        ✓ actif
      </span>
    );
  }

  if (hasRef && !hasVideo) {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
        📷 sans vidéo
      </span>
    );
  }

  return null;
}
