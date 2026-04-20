import { useEffect, useState } from 'react';
import { Check, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  isPending: boolean;
  isError: boolean;
  lastSavedAt: number | null;
}

export function SaveStatusBadge({ isPending, isError, lastSavedAt }: Props) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 10_000);
    return () => clearInterval(t);
  }, []);

  if (isPending) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Enregistrement…
      </span>
    );
  }
  if (isError) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-destructive">
        <AlertCircle className="w-3 h-3" /> Erreur de sauvegarde
      </span>
    );
  }
  if (lastSavedAt) {
    const sec = Math.floor((Date.now() - lastSavedAt) / 1000);
    const label =
      sec < 5 ? "à l'instant" :
      sec < 60 ? `il y a ${sec}s` :
      sec < 3600 ? `il y a ${Math.floor(sec / 60)}min` :
      `il y a ${Math.floor(sec / 3600)}h`;
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <Check className="w-3 h-3" /> Enregistré {label}
      </span>
    );
  }
  return null;
}
