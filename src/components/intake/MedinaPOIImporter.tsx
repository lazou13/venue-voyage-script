import { useState } from 'react';
import { useMedinaPOIs, type MedinaPOI } from '@/hooks/useMedinaPOIs';
import { usePOIMedia, type POIMedia } from '@/hooks/usePOIMedia';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Search, Image, Mic, Video, MapPin } from 'lucide-react';

// ─── Media picker sub-component ─────────────────────────────
function MediaPicker({
  medinaPoiId,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  medinaPoiId: string;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (allIds: string[]) => void;
}) {
  const { media, isLoading } = usePOIMedia(medinaPoiId);

  if (isLoading) return <div className="py-4 text-center text-muted-foreground text-sm">Chargement médias…</div>;
  if (media.length === 0) return <p className="text-sm text-muted-foreground italic py-2">Aucun média attaché</p>;

  const iconMap: Record<string, React.ElementType> = { photo: Image, audio: Mic, video: Video };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{selectedIds.size}/{media.length} sélectionné(s)</span>
        <Button variant="ghost" size="sm" className="text-xs h-6" onClick={() => onToggleAll(media.map(m => m.id))}>
          {selectedIds.size === media.length ? 'Désélectionner tout' : 'Tout sélectionner'}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto">
        {media.map((m) => {
          const Icon = iconMap[m.media_type] ?? Image;
          return (
            <label key={m.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer text-sm">
              <Checkbox
                checked={selectedIds.has(m.id)}
                onCheckedChange={() => onToggle(m.id)}
              />
              <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <span className="truncate flex-1">{m.storage_path.split('/').pop()}</span>
              <Badge variant="outline" className="text-[10px] px-1">{m.media_type}</Badge>
              {m.is_cover && <Badge variant="secondary" className="text-[10px] px-1">cover</Badge>}
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main importer dialog ───────────────────────────────────
interface MedinaPOIImporterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (medinaPoiId: string, attachMedia: boolean, selectedMediaIds?: string[]) => Promise<void>;
  isImporting: boolean;
}

export function MedinaPOIImporter({ open, onOpenChange, onImport, isImporting }: MedinaPOIImporterProps) {
  const { pois, isLoading } = useMedinaPOIs();
  const [search, setSearch] = useState('');
  const [selectedPoiId, setSelectedPoiId] = useState<string | null>(null);
  const [attachMedia, setAttachMedia] = useState(true);
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  // Reset on close
  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setSelectedPoiId(null);
      setSearch('');
      setAttachMedia(true);
      setSelectedMediaIds(new Set());
      setShowMediaPicker(false);
    }
    onOpenChange(v);
  };

  const filtered = pois.filter((p) => {
    if (!search) return p.is_active;
    const q = search.toLowerCase();
    return p.is_active && (
      p.name.toLowerCase().includes(q) ||
      p.zone.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q)
    );
  });

  const selectedPOI = pois.find((p) => p.id === selectedPoiId);

  const handleSelectPoi = (id: string) => {
    setSelectedPoiId(id);
    setSelectedMediaIds(new Set());
    setShowMediaPicker(false);
  };

  const toggleMediaId = (id: string) => {
    setSelectedMediaIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (!selectedPoiId) return;
    const mediaIds = attachMedia && selectedMediaIds.size > 0 ? Array.from(selectedMediaIds) : undefined;
    await onImport(selectedPoiId, attachMedia, mediaIds);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer depuis Bibliothèque Médina</DialogTitle>
          <DialogDescription>Sélectionnez un POI à copier dans ce projet</DialogDescription>
        </DialogHeader>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, zone, catégorie…"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* POI list */}
        <ScrollArea className="h-52 border rounded-lg">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Aucun POI trouvé</p>
          ) : (
            <div className="p-1 space-y-0.5">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectPoi(p.id)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                    p.id === selectedPoiId
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  <div className="font-medium">{p.name}</div>
                  <div className="flex gap-2 mt-0.5 text-xs opacity-70">
                    {p.zone && <span>{p.zone}</span>}
                    <span>· {p.category}</span>
                    {p.lat && p.lng && (
                      <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> GPS</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Media options */}
        {selectedPOI && (
          <div className="space-y-3 border-t pt-3">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={attachMedia}
                onCheckedChange={(v) => {
                  setAttachMedia(!!v);
                  if (!v) setShowMediaPicker(false);
                }}
              />
              Attacher les médias de la bibliothèque
            </label>

            {attachMedia && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowMediaPicker(!showMediaPicker)}
                >
                  {showMediaPicker ? 'Masquer sélection avancée' : 'Sélection avancée des médias ▸'}
                </Button>

                {showMediaPicker && (
                  <MediaPicker
                    medinaPoiId={selectedPoiId!}
                    selectedIds={selectedMediaIds}
                    onToggle={toggleMediaId}
                    onToggleAll={(allIds) => {
                      if (selectedMediaIds.size === allIds.length) {
                        setSelectedMediaIds(new Set());
                      } else {
                        setSelectedMediaIds(new Set(allIds));
                      }
                    }}
                  />
                )}
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Annuler</Button>
          <Button onClick={handleImport} disabled={!selectedPoiId || isImporting}>
            {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
            Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
