import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Video, Trash2, Plus } from 'lucide-react';
import type { MedinaPOI } from '@/hooks/useMedinaPOIs';

interface VideoItem {
  youtube_id: string;
  title?: string;
  source?: string;
}

interface Props {
  poi: MedinaPOI;
  onSave: (patch: Partial<MedinaPOI>) => void;
}

function extractYoutubeId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[\w-]{8,15}$/.test(trimmed)) return trimmed;
  const m = trimmed.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/)([\w-]{8,15})/);
  return m ? m[1] : null;
}

export function VideosBlock({ poi, onSave }: Props) {
  const videos: VideoItem[] = Array.isArray((poi as any).video_urls) ? ((poi as any).video_urls as VideoItem[]) : [];
  const [newUrl, setNewUrl] = useState('');
  const [newTitle, setNewTitle] = useState('');

  const add = () => {
    const id = extractYoutubeId(newUrl);
    if (!id) return;
    if (videos.some((v) => v.youtube_id === id)) return;
    onSave({ video_urls: [...videos, { youtube_id: id, title: newTitle.trim() || undefined, source: newUrl.trim() }] } as any);
    setNewUrl('');
    setNewTitle('');
  };

  const remove = (id: string) => {
    onSave({ video_urls: videos.filter((v) => v.youtube_id !== id) } as any);
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-4 bg-card">
      <h3 className="text-sm font-semibold flex items-center gap-2">
        <Video className="w-4 h-4" /> Vidéos YouTube ({videos.length})
      </h3>

      {videos.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Aucune vidéo. Ajoutez une URL YouTube ou utilisez l'agent d'enrichissement.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {videos.map((v) => (
            <div key={v.youtube_id} className="space-y-1 rounded-md border border-border p-2 bg-background">
              <div className="aspect-video w-full overflow-hidden rounded">
                <iframe
                  src={`https://www.youtube.com/embed/${v.youtube_id}`}
                  title={v.title || v.youtube_id}
                  className="w-full h-full"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] truncate flex-1" title={v.title}>{v.title || v.youtube_id}</span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => remove(v.youtube_id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 pt-2 border-t border-border">
        <div>
          <Label className="text-[10px]">URL ou ID YouTube</Label>
          <Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://youtube.com/…" className="h-8 text-xs" />
        </div>
        <div>
          <Label className="text-[10px]">Titre (optionnel)</Label>
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Visite guidée…" className="h-8 text-xs" />
        </div>
        <div className="flex items-end">
          <Button size="sm" onClick={add} disabled={!extractYoutubeId(newUrl)} className="h-8">
            <Plus className="w-3 h-3 mr-1" /> Ajouter
          </Button>
        </div>
      </div>
    </div>
  );
}
