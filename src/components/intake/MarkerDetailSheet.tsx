import { useState, useEffect, useRef } from 'react';
import { X, Camera, MapPin, Check, Trash2, Volume2, Navigation, Send, Search, Utensils, Globe, History, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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

type ChatMessage = { role: 'user' | 'assistant'; content: string };

// Helper to build enriched note from analysis
function buildEnrichedNote(a: any): string {
  const parts: string[] = [
    `📍 ${a.location_guess || ''}`,
    `📂 ${a.category || ''}${a.sub_category ? ` / ${a.sub_category}` : ''}`,
    ...(a.website_url ? [`🌐 ${a.website_url}`] : []),
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

// Summarize analysis for chat display
function summarizeAnalysis(a: any): string {
  const lines: string[] = [];
  if (a.location_guess) lines.push(`📍 **${a.location_guess}**`);
  if (a.category) lines.push(`📂 ${a.category}${a.sub_category ? ` / ${a.sub_category}` : ''}`);
  if (a.guide_narration?.fr) lines.push(`\n${a.guide_narration.fr.slice(0, 300)}${a.guide_narration.fr.length > 300 ? '...' : ''}`);
  if (a.historical_anecdote) lines.push(`\n🏛️ ${a.historical_anecdote.slice(0, 200)}${a.historical_anecdote.length > 200 ? '...' : ''}`);
  return lines.join('\n') || 'Analyse terminée.';
}

// Lightweight previous_analysis for chat context
function lightAnalysis(a: any) {
  return {
    location_guess: a.location_guess,
    category: a.category,
    sub_category: a.sub_category,
    summary_library: a.summary_library,
    historical_anecdote: a.historical_anecdote?.slice(0, 200),
    guide_narration_fr: a.guide_narration?.fr?.slice(0, 300),
    website_url: a.website_url,
  };
}

const QUICK_ACTIONS = [
  { label: '🔍 Recherche approfondie', prompt: 'Fais une recherche approfondie sur ce lieu : histoire complète, anecdotes méconnues, contexte architectural et culturel.' },
  { label: '✏️ Corrige le nom', prompt: 'Le nom du lieu est incorrect. Le vrai nom est : ' },
  { label: '🏛️ Plus d\'histoire', prompt: 'Donne-moi beaucoup plus de détails historiques sur ce lieu.' },
  { label: '🍽️ Restaurants', prompt: 'Quels sont les meilleurs restaurants à proximité ? Détaille les cartes, prix et avis.' },
  { label: '🌐 Site web', prompt: 'Trouve le site web officiel, la page TripAdvisor et le compte Instagram de ce lieu.' },
  { label: '📸 Tips photo', prompt: 'Donne-moi les meilleurs conseils photo pour ce lieu : angles, heures, lumière.' },
];

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
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);

  // Editable fields
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [note, setNote] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [audioUrl, setAudioUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);

  // Sync fields when marker changes
  useEffect(() => {
    if (marker) {
      setLat(String(marker.lat));
      setLng(String(marker.lng));
      const existingNote = marker.note || '';
      if (analysis && existingNote.length < 50) {
        setNote(buildEnrichedNote(analysis));
      } else {
        setNote(existingNote);
      }
      setPhotoUrl(marker.photo_url || '');
      setAudioUrl(marker.audio_url || '');
      setChatMessages([]);
      setChatInput('');
    }
  }, [marker?.id, open]);

  // When initial analysis arrives, seed chat with summary
  useEffect(() => {
    if (analysis && marker && chatMessages.length === 0) {
      setChatMessages([{ role: 'assistant', content: summarizeAnalysis(analysis) }]);
      setNote(buildEnrichedNote(analysis));
    }
  }, [analysis]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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
      await onSave({ lat: latN, lng: lngN, note: note || null, photoUrl: photoUrl || null, audioUrl: audioUrl || null });
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

  const handleSendChat = async (message: string) => {
    if (!message.trim() || isAiThinking) return;

    const userMsg: ChatMessage = { role: 'user', content: message.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsAiThinking(true);

    try {
      // Build chat_history from existing messages
      const history = [...chatMessages, userMsg].map(m => ({ role: m.role, content: m.content }));

      const { data: existingPois } = await supabase
        .from('medina_pois')
        .select('name, category, zone, lat, lng')
        .eq('is_active', true)
        .limit(50);

      const nearbyMarkers = allMarkers
        .filter(m => {
          const dlat = m.lat - marker.lat;
          const dlng = m.lng - marker.lng;
          const distApprox = Math.sqrt(dlat * dlat + dlng * dlng) * 111000;
          return distApprox < 200 && m.note && m.id !== marker.id;
        })
        .slice(0, 5)
        .map(m => ({ lat: m.lat, lng: m.lng, note: m.note }));

      const body: any = {
        photo_url: photoUrl || undefined,
        audio_url: audioUrl || undefined,
        lat: marker.lat,
        lng: marker.lng,
        note: note || undefined,
        existing_pois: existingPois || [],
        nearby_markers: nearbyMarkers,
        chat_history: history,
        previous_analysis: analysis ? lightAnalysis(analysis) : undefined,
      };

      const { data, error } = await supabase.functions.invoke('analyze-marker', { body });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Update analysis and note
      onAnalysisUpdate(marker.id, data.analysis);
      setNote(buildEnrichedNote(data.analysis));

      // Add assistant response to chat
      setChatMessages(prev => [...prev, { role: 'assistant', content: summarizeAnalysis(data.analysis) }]);
      toast({ title: 'Analyse mise à jour ✓' });
    } catch (err) {
      const errMsg = (err as Error).message || 'Erreur inconnue';
      setChatMessages(prev => [...prev, { role: 'assistant', content: `❌ Erreur : ${errMsg}` }]);
      toast({ title: 'Erreur IA', description: errMsg, variant: 'destructive' });
    } finally {
      setIsAiThinking(false);
    }
  };

  const handleInitialEnrich = async () => {
    setIsAiThinking(true);
    setChatMessages(prev => [...prev, { role: 'user', content: '🧠 Lance l\'analyse complète de ce marqueur.' }]);
    try {
      const { data: existingPois } = await supabase
        .from('medina_pois')
        .select('name, category, zone, lat, lng')
        .eq('is_active', true)
        .limit(50);

      const nearbyMarkers = allMarkers
        .filter(m => {
          const dlat = m.lat - marker.lat;
          const dlng = m.lng - marker.lng;
          const distApprox = Math.sqrt(dlat * dlat + dlng * dlng) * 111000;
          return distApprox < 200 && m.note && m.id !== marker.id;
        })
        .slice(0, 5)
        .map(m => ({ lat: m.lat, lng: m.lng, note: m.note }));

      const { data, error } = await supabase.functions.invoke('analyze-marker', {
        body: {
          photo_url: photoUrl || undefined,
          audio_url: audioUrl || undefined,
          lat: marker.lat,
          lng: marker.lng,
          note: note || undefined,
          existing_pois: existingPois || [],
          nearby_markers: nearbyMarkers,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      onAnalysisUpdate(marker.id, data.analysis);
      setNote(buildEnrichedNote(data.analysis));
      setChatMessages(prev => [...prev, { role: 'assistant', content: summarizeAnalysis(data.analysis) }]);
      toast({ title: 'Analyse IA terminée ✓' });
    } catch (err) {
      const errMsg = (err as Error).message || 'Erreur inconnue';
      setChatMessages(prev => [...prev, { role: 'assistant', content: `❌ Erreur : ${errMsg}` }]);
      toast({ title: 'Erreur IA', description: errMsg, variant: 'destructive' });
    } finally {
      setIsAiThinking(false);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendChat(chatInput);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            Détail du marqueur
            {analysis && <Badge variant="default" className="text-xs">🧠 Analysé</Badge>}
            {marker.promoted && <Badge variant="secondary" className="text-xs">Bibliothèque</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-2">
          <div className="grid grid-cols-1 md:grid-cols-[240px_1fr_340px] gap-4">
            {/* LEFT: coords, photo, audio */}
            <div className="space-y-3">
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
                <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Navigation className="w-3 h-3" /> Voir sur Maps
                </a>
              </div>

              {/* Photo */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">Photo</Label>
                <input type="file" accept="image/*" ref={photoRef} onChange={handlePhotoUpload} className="hidden" />
                {photoUrl ? (
                  <div className="relative">
                    <img src={photoUrl} alt="Marker" className="w-full rounded-lg object-cover max-h-36 border" />
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

              {/* AI analysis badge */}
              {analysis?.location_guess && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-muted">
                  <MapPin className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-xs font-medium">{analysis.location_guess}</span>
                  {analysis.category && <Badge variant="outline" className="text-xs">{analysis.category}</Badge>}
                </div>
              )}

              {/* Initial enrich button */}
              {!analysis && (
                <Button variant="outline" size="sm" className="w-full gap-2" disabled={isAiThinking} onClick={handleInitialEnrich}>
                  {isAiThinking ? <span className="animate-spin">⏳</span> : <Sparkles className="w-4 h-4" />}
                  {isAiThinking ? 'Analyse en cours...' : 'Enrichir avec l\'IA'}
                </Button>
              )}
            </div>

            {/* CENTER: editable note */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Contenu du marqueur</Label>
              <Textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                className="min-h-[380px] text-sm font-mono leading-relaxed"
                placeholder="Note du marqueur... L'analyse IA viendra enrichir ce champ."
              />
              <p className="text-xs text-muted-foreground">
                Vous pouvez éditer librement. L'IA pré-remplit avec son analyse, mais vous avez le dernier mot.
              </p>
            </div>

            {/* RIGHT: Chat IA */}
            <div className="flex flex-col border rounded-lg bg-muted/30 min-h-[420px]">
              <div className="px-3 py-2 border-b flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Chat IA</span>
                {isAiThinking && <span className="text-xs text-muted-foreground animate-pulse">réflexion...</span>}
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 px-3 py-2">
                <div className="space-y-3">
                  {chatMessages.length === 0 && !analysis && (
                    <p className="text-xs text-muted-foreground text-center py-8">
                      Lancez l'analyse IA puis discutez ici pour corriger, approfondir ou poser des questions.
                    </p>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[90%] rounded-lg px-3 py-2 text-xs whitespace-pre-wrap',
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-background border'
                      )}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isAiThinking && (
                    <div className="flex justify-start">
                      <div className="bg-background border rounded-lg px-3 py-2 text-xs">
                        <span className="animate-pulse">🧠 Analyse en cours...</span>
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </ScrollArea>

              {/* Quick actions */}
              {analysis && (
                <div className="px-3 py-1.5 border-t flex flex-wrap gap-1">
                  {QUICK_ACTIONS.map((action, i) => (
                    <button
                      key={i}
                      className="text-[10px] px-2 py-1 rounded-full border bg-background hover:bg-accent transition-colors"
                      disabled={isAiThinking}
                      onClick={() => {
                        if (action.prompt.endsWith(': ')) {
                          setChatInput(action.prompt);
                          chatInputRef.current?.focus();
                        } else {
                          handleSendChat(action.prompt);
                        }
                      }}
                    >
                      {action.label}
                    </button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="px-3 py-2 border-t flex gap-2">
                <textarea
                  ref={chatInputRef}
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Corrigez, demandez une recherche..."
                  className="flex-1 text-xs bg-background border rounded-md px-2 py-1.5 resize-none min-h-[36px] max-h-[80px] focus:outline-none focus:ring-1 focus:ring-ring"
                  rows={1}
                  disabled={isAiThinking}
                />
                <Button size="icon" className="h-9 w-9 shrink-0" disabled={isAiThinking || !chatInput.trim()} onClick={() => handleSendChat(chatInput)}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <DialogFooter className="px-6 py-4 border-t flex-wrap gap-2">
          <Button variant="destructive" size="sm" onClick={() => { onDelete(marker.id, marker.trace_id); onClose(); }}>
            <Trash2 className="w-4 h-4 mr-1" /> Supprimer
          </Button>
          <div className="flex-1" />
          <Button variant="outline" onClick={onClose}>Fermer</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
          <Button variant="secondary" className="gap-1" disabled={marker.promoted || isSaving || isApproving} onClick={handleApprove}>
            {isApproving ? '⏳ Promotion...' : '✅ Approuver + Bibliothèque'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
