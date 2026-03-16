import { useState, useEffect, useRef } from 'react';
import { X, Camera, MapPin, Check, Trash2, Volume2, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import type { RouteMarker } from '@/hooks/useRouteRecorder';

interface MarkerDetailSheetProps {
  marker: RouteMarker | null;
  analysis: any | null;
  allMarkers: RouteMarker[];
  projectId: string;
  open: boolean;
  onClose: () => void;
  onSave: (data: { lat: number; lng: number; note: string | null; photoUrl: string | null; audioUrl: string | null }) => Promise<void>;
  onDelete: (markerId: string, traceId: string) => void;
  onApproveAndPromote: (markerId: string) => Promise<void>;
  onAnalysisUpdate: (markerId: string, analysis: any) => void;
}

// Helper to build enriched note from analysis
function buildEnrichedNote(a: any): string {
  const parts: string[] = [
    `📍 ${a.location_guess || ''}`,
    `📂 ${a.category || ''}${a.sub_category ? ` / ${a.sub_category}` : ''}`,
    '',
    '📖 Guide:',
    a.guide_narration?.fr || '',
    '',
    '🏛️ Anecdote:',
    a.historical_anecdote || '',
    '',
    '📚 Bibliothèque:',
    a.summary_library || '',
  ];

  if (a.nearby_restaurants?.length > 0) {
    parts.push('', '🍽️ Restaurants:');
    a.nearby_restaurants.forEach((r: any) => {
      const rParts = [`- ${r.name} — ${r.specialty} (${r.price_range}) ⭐ ${r.rating}`];
      if (r.menu_url) rParts.push(`  🍽️ Carte: ${r.menu_url}`);
      if (r.google_maps_query) rParts.push(`  📍 Maps: ${r.google_maps_query}`);
      if (r.google_reviews?.length > 0) {
        rParts.push('  📝 Avis:');
        r.google_reviews.slice(0, 5).forEach((rev: any) => {
          rParts.push(`    "${rev.text}" — ${rev.author} ⭐${rev.rating}`);
        });
      }
      parts.push(rParts.join('\n'));
    });
  }

  if (a.nearby_pois?.length > 0) {
    parts.push('', '🏛️ POIs proches:');
    a.nearby_pois.forEach((p: any) => {
      const pParts = [`- ${p.name} (${p.type}) — ${p.description_fr}`];
      if (p.ticket_url) pParts.push(`  🎫 Billets: ${p.ticket_url}`);
      if (p.ticket_price) pParts.push(`  💰 Tarif: ${p.ticket_price}`);
      if (p.opening_hours) pParts.push(`  🕐 Horaires: ${p.opening_hours}`);
      parts.push(pParts.join('\n'));
    });
  }

  return parts.join('\n');
}

export function MarkerDetailSheet({
  marker,
  analysis,
  allMarkers,
  projectId,
  open,
  onClose,
  onSave,
  onDelete,
  onApproveAndPromote,
  onAnalysisUpdate,
}: MarkerDetailSheetProps) {
  const { toast } = useToast();
  const { uploadFile, isUploading } = useFileUpload();
  const photoRef = useRef<HTMLInputElement>(null);

  // Editable fields
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // AI enrichment
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAiPrompt, setShowAiPrompt] = useState(false);

  // Sync fields when marker changes
  useEffect(() => {
    if (marker) {
      setLat(String(marker.lat));
      setLng(String(marker.lng));
      // If analysis exists and note is short, pre-fill with enriched note
      const existingNote = marker.note || '';
      if (analysis && existingNote.length < 50) {
        setNote(buildEnrichedNote(analysis));
      } else {
        setNote(existingNote);
      }
      setPhotoUrl(marker.photo_url || '');
      setAudioUrl(marker.audio_url || '');
    }
  }, [marker?.id, open]);

  // When analysis is received/updated, merge into note if note is still short
  useEffect(() => {
    if (analysis && marker) {
      const currentNote = note.trim();
      if (currentNote.length < 50 || !currentNote.includes('📍')) {
        setNote(buildEnrichedNote(analysis));
      }
    }
  }, [analysis]);

  if (!marker) return null;

  const handleSave = async (): Promise<boolean> => {
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (isNaN(latN) || latN < -90 || latN > 90 || isNaN(lngN) || lngN < -180 || lngN > 180) {
      toast({ title: 'Coordonnées invalides', variant: 'destructive' });
      return false;
    }
    setIsSaving(true);
    try {
      await onSave({
        lat: latN,
        lng: lngN,
        note: note || null,
        photoUrl: photoUrl || null,
        audioUrl: audioUrl || null,
      });
      toast({ title: 'Marqueur enregistré ✓' });
      return true;
    } catch (err) {
      toast({ title: 'Erreur', description: (err as Error).message, variant: 'destructive' });
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadFile(file, `route-markers/${projectId}`);
    if (url) setPhotoUrl(url);
    e.target.value = '';
  };

  const handleEnrichAI = async (customPrompt?: string) => {
    setIsAnalyzing(true);
    try {
      const { data: existingPois } = await supabase
        .from('medina_pois')
        .select('name, category, zone, lat, lng')
        .eq('is_active', true)
        .limit(100);

      const nearbyMarkers = allMarkers
        .filter(m => {
          const dlat = m.lat - marker.lat;
          const dlng = m.lng - marker.lng;
          const distApprox = Math.sqrt(dlat * dlat + dlng * dlng) * 111000;
          return distApprox < 200 && m.note && m.id !== marker.id;
        })
        .slice(0, 10)
        .map(m => ({ lat: m.lat, lng: m.lng, note: m.note, photo_url: m.photo_url, audio_url: m.audio_url }));

      const body: any = {
        photo_url: photoUrl || undefined,
        audio_url: audioUrl || undefined,
        lat: marker.lat,
        lng: marker.lng,
        note: note || undefined,
        existing_pois: existingPois || [],
        nearby_markers: nearbyMarkers,
      };
      if (customPrompt) {
        body.custom_instruction = customPrompt;
      }

      const { data, error } = await supabase.functions.invoke('analyze-marker', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      onAnalysisUpdate(marker.id, data.analysis);
      setNote(buildEnrichedNote(data.analysis));
      setShowAiPrompt(false);
      setAiPrompt('');
      toast({ title: 'Analyse IA terminée ✓' });
    } catch (err) {
      toast({ title: 'Erreur IA', description: (err as Error).message, variant: 'destructive' });
    } finally {
      setIsAnalyzing(false);
    }
  };


  const handleApprove = async () => {
    const saved = await handleSave();
    if (!saved) return;
    setIsApproving(true);
    try {
      await onApproveAndPromote(marker.id);
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Détail du marqueur
            {analysis && <Badge variant="default" className="text-xs">🧠 Analysé</Badge>}
            {marker.promoted && <Badge variant="secondary" className="text-xs">Bibliothèque</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-2">
          <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
            {/* LEFT: coords, photo, audio */}
            <div className="space-y-4">
              {/* GPS */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Coordonnées GPS</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Lat</Label>
                    <Input type="number" step="0.000001" min={-90} max={90} value={lat} onChange={e => setLat(e.target.value)} className="text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Lng</Label>
                    <Input type="number" step="0.000001" min={-180} max={180} value={lng} onChange={e => setLng(e.target.value)} className="text-xs" />
                  </div>
                </div>
                <a
                  href={`https://www.google.com/maps?q=${lat},${lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  <Navigation className="w-3 h-3" /> Voir sur Maps
                </a>
              </div>

              {/* Photo */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Photo</Label>
                <input type="file" accept="image/*" ref={photoRef} onChange={handlePhotoUpload} className="hidden" />
                {photoUrl ? (
                  <div className="relative">
                    <img src={photoUrl} alt="Marker" className="w-full rounded-lg object-cover max-h-48 border" />
                    <div className="absolute top-1 right-1 flex gap-1">
                      <Button variant="secondary" size="icon" className="h-6 w-6" onClick={() => photoRef.current?.click()} disabled={isUploading}>
                        <Camera className="w-3 h-3" />
                      </Button>
                      <Button variant="destructive" size="icon" className="h-6 w-6" onClick={() => setPhotoUrl('')}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => photoRef.current?.click()} disabled={isUploading}>
                    <Camera className="w-4 h-4" />
                    {isUploading ? 'Upload...' : 'Ajouter photo'}
                  </Button>
                )}
              </div>

              {/* Audio */}
              {audioUrl && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Volume2 className="w-3 h-3" /> Note vocale
                  </Label>
                  <audio controls className="w-full h-8">
                    <source src={audioUrl} type="audio/webm" />
                  </audio>
                </div>
              )}

              {/* AI actions */}
              <div className="space-y-2 border-t pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2"
                  disabled={isAnalyzing}
                  onClick={() => handleEnrichAI()}
                >
                  {isAnalyzing ? <span className="animate-spin">⏳</span> : <span>🧠</span>}
                  {isAnalyzing ? 'Analyse en cours...' : 'Enrichir avec l\'IA'}
                </Button>
                {!showAiPrompt ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full gap-2 text-xs"
                    onClick={() => setShowAiPrompt(true)}
                  >
                    ✏️ Demander une modification à l'IA
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      placeholder="Ex: Ajoute plus de détails sur l'histoire du lieu..."
                      value={aiPrompt}
                      onChange={e => setAiPrompt(e.target.value)}
                      className="min-h-[60px] text-xs"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 gap-1" disabled={isAnalyzing || !aiPrompt.trim()} onClick={() => handleEnrichAI(aiPrompt)}>
                        🧠 Envoyer
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => { setShowAiPrompt(false); setAiPrompt(''); }}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: editable note content */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Contenu du marqueur</Label>
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                className="min-h-[400px] text-sm font-mono leading-relaxed"
                placeholder="Note du marqueur... L'analyse IA viendra enrichir ce champ."
              />
              <p className="text-xs text-muted-foreground">
                Vous pouvez éditer librement le texte ci-dessus. L'IA le pré-remplit avec son analyse, mais vous avez le dernier mot.
              </p>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <DialogFooter className="px-6 py-4 border-t flex-wrap gap-2">
          <Button
            variant="destructive"
            size="sm"
            onClick={() => {
              onDelete(marker.id, marker.trace_id);
              onClose();
            }}
          >
            <Trash2 className="w-4 h-4 mr-1" /> Supprimer
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
          <Button
            variant="secondary"
            className="gap-1"
            disabled={marker.promoted || isSaving || isApproving}
            onClick={handleApprove}
          >
            {isApproving ? '⏳ Promotion...' : '✅ Approuver + Bibliothèque'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
