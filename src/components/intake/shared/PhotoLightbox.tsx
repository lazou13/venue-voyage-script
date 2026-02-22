import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface LightboxPhoto {
  url: string;
  note?: string | null;
  lat?: number;
  lng?: number;
}

interface PhotoLightboxProps {
  photos: LightboxPhoto[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
}

export function PhotoLightbox({ photos, initialIndex, open, onClose }: PhotoLightboxProps) {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex, open]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
    if (e.key === 'ArrowRight') setIndex(i => Math.min(photos.length - 1, i + 1));
  }, [photos.length, onClose]);

  useEffect(() => {
    if (!open) return;
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, handleKeyDown]);

  if (!open || photos.length === 0) return null;

  const photo = photos[index];

  const handleDownload = async () => {
    try {
      const response = await fetch(photo.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = photo.url.split('.').pop()?.split('?')[0] || 'jpg';
      a.download = `photo_${index + 1}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in new tab
      window.open(photo.url, '_blank');
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] bg-black/95 flex flex-col"
      onClick={onClose}
    >
      {/* Top bar */}
      <div 
        className="flex items-center justify-between p-3 text-white"
        onClick={e => e.stopPropagation()}
      >
        <span className="text-sm font-medium">
          {index + 1} / {photos.length}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-9 w-9"
            onClick={handleDownload}
            title="Télécharger"
          >
            <Download className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-white/20 h-9 w-9"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Image */}
      <div 
        className="flex-1 flex items-center justify-center relative min-h-0 px-12"
        onClick={e => e.stopPropagation()}
      >
        {photos.length > 1 && index > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-2 text-white hover:bg-white/20 h-10 w-10"
            onClick={() => setIndex(i => i - 1)}
          >
            <ChevronLeft className="w-6 h-6" />
          </Button>
        )}

        <img
          src={photo.url}
          alt={photo.note || `Photo ${index + 1}`}
          className="max-h-full max-w-full object-contain rounded-lg"
        />

        {photos.length > 1 && index < photos.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-2 text-white hover:bg-white/20 h-10 w-10"
            onClick={() => setIndex(i => i + 1)}
          >
            <ChevronRight className="w-6 h-6" />
          </Button>
        )}
      </div>

      {/* Bottom info */}
      <div 
        className="p-3 text-white text-center space-y-1"
        onClick={e => e.stopPropagation()}
      >
        {photo.note && (
          <p className="text-sm">{photo.note}</p>
        )}
        {photo.lat != null && photo.lng != null && (
          <p className="text-xs text-white/60 flex items-center justify-center gap-1">
            <MapPin className="w-3 h-3" />
            {photo.lat.toFixed(5)}, {photo.lng.toFixed(5)}
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
