import { MapPin, Route, Settings2, Globe, Gamepad2, Clock, AlertTriangle, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CrossTabStats } from '@/hooks/useCrossTabStats';

interface CrossTabBadge {
  label: string;
  icon?: React.ReactNode;
  variant?: 'default' | 'secondary' | 'outline' | 'destructive';
  targetTab?: string;
}

interface CrossTabSummaryProps {
  tab: 'core' | 'parcours' | 'terrain' | 'etapes';
  stats: CrossTabStats;
  onNavigate?: (tab: string) => void;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
  return `${Math.round(meters)} m`;
}

export function CrossTabSummary({ tab, stats, onNavigate }: CrossTabSummaryProps) {
  const badges: CrossTabBadge[] = [];

  if (tab === 'core') {
    badges.push({
      label: `${stats.poiCount} étape${stats.poiCount !== 1 ? 's' : ''}`,
      icon: <MapPin className="w-3 h-3" />,
      targetTab: 'fieldwork',
    });
    if (stats.totalDistanceMeters > 0) {
      badges.push({
        label: formatDistance(stats.totalDistanceMeters),
        icon: <Route className="w-3 h-3" />,
        targetTab: 'route_recon',
      });
    }
    if (stats.poiCount > 0) {
      badges.push({
        label: `${stats.configuredSteps}/${stats.poiCount} configurées`,
        icon: <Settings2 className="w-3 h-3" />,
        variant: stats.unconfiguredSteps > 0 ? 'outline' : 'secondary',
        targetTab: 'steps',
      });
    }
    if (stats.autoDurationMin > 0 && !stats.durationMin) {
      badges.push({
        label: `Durée auto : ${stats.autoDurationMin} min`,
        icon: <Clock className="w-3 h-3" />,
        variant: 'outline',
      });
    }
  }

  if (tab === 'parcours') {
    if (stats.durationMin) {
      badges.push({
        label: `Durée cible : ${stats.durationMin} min`,
        icon: <Clock className="w-3 h-3" />,
        targetTab: 'core',
      });
    }
    if (stats.difficulty) {
      badges.push({
        label: `Difficulté : ${stats.difficulty}/5`,
        targetTab: 'core',
      });
    }
    badges.push({
      label: `${stats.poiCount} étape${stats.poiCount !== 1 ? 's' : ''} définies`,
      icon: <MapPin className="w-3 h-3" />,
      targetTab: 'fieldwork',
    });
  }

  if (tab === 'terrain') {
    if (stats.projectType) {
      const typeLabels: Record<string, string> = {
        establishment: 'Établissement',
        tourist_spot: 'Site Touristique',
        route_recon: 'Parcours',
      };
      badges.push({
        label: typeLabels[stats.projectType] || stats.projectType,
        targetTab: 'core',
      });
    }
    if (stats.questType) {
      badges.push({
        label: stats.questType,
        icon: <Gamepad2 className="w-3 h-3" />,
        targetTab: 'core',
      });
    }
    if (stats.traceCount > 0) {
      badges.push({
        label: `${stats.traceCount} trace${stats.traceCount !== 1 ? 's' : ''}`,
        icon: <Route className="w-3 h-3" />,
        targetTab: 'route_recon',
      });
    }
    if (stats.unconfiguredSteps > 0) {
      badges.push({
        label: `${stats.unconfiguredSteps} sans config`,
        icon: <AlertTriangle className="w-3 h-3" />,
        variant: 'outline',
        targetTab: 'steps',
      });
    }
  }

  if (tab === 'etapes') {
    if (stats.languages.length > 1) {
      badges.push({
        label: `Langues : ${stats.languages.map((l: string) => l.toUpperCase()).join(', ')}`,
        icon: <Globe className="w-3 h-3" />,
        targetTab: 'core',
      });
    }
    if (stats.questType) {
      badges.push({
        label: stats.questType,
        icon: <Gamepad2 className="w-3 h-3" />,
        targetTab: 'core',
      });
    }
    if (stats.poisWithoutPhoto > 0) {
      badges.push({
        label: `${stats.poisWithoutPhoto} sans photo`,
        icon: <AlertTriangle className="w-3 h-3" />,
        variant: 'outline',
        targetTab: 'fieldwork',
      });
    }
  }

  if (badges.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-2.5 mb-4 rounded-xl bg-muted/40 border border-border/50">
      <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      {badges.map((badge, i) => (
        <Badge
          key={i}
          variant={badge.variant || 'secondary'}
          className={cn(
            'gap-1 text-xs py-0.5 px-2',
            badge.targetTab && onNavigate && 'cursor-pointer hover:bg-primary/20 transition-colors'
          )}
          onClick={() => badge.targetTab && onNavigate?.(badge.targetTab)}
        >
          {badge.icon}
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}
