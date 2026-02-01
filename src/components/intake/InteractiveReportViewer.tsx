/**
 * Interactive Report Viewer
 * Dialog component for generating and exporting route reconnaissance reports
 * 
 * Features:
 * - Summary view (no iframe for security/CSP reasons)
 * - Open full report in new tab
 * - Export: PDF (autoPrint), Word, HTML, JSON
 * - Config controls for transport mode, speed, players
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  BarChart3,
  ExternalLink,
  Printer,
  FileText,
  FileCode,
  FileJson,
  MapPin,
  Clock,
  Route,
} from 'lucide-react';

// Import types from useRouteRecorder
import type { RouteTrace, RouteMarker } from '@/hooks/useRouteRecorder';

// Import generator functions
import {
  buildReportPayload,
  generateInteractiveReportHTML,
  generateWordExportHTML,
  downloadTextFile,
  ReportConfig,
  ReportPayload,
} from '@/lib/interactiveReportGenerator';

interface InteractiveReportViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trace: RouteTrace;
  markers: RouteMarker[];
  projectName: string;
  projectCity?: string;
}

// Speed defaults per transport mode
const SPEED_DEFAULTS: Record<ReportConfig['transportMode'], number> = {
  walking: 5,
  scooter: 15,
  car: 30,
};

export function InteractiveReportViewer({
  open,
  onOpenChange,
  trace,
  markers,
  projectName,
  projectCity,
}: InteractiveReportViewerProps) {
  // Config state
  const [transportMode, setTransportMode] = useState<ReportConfig['transportMode']>('walking');
  const [speedKmh, setSpeedKmh] = useState(5);
  const [playersCount, setPlayersCount] = useState(1);

  // Blob URL ref for cleanup
  // We store the last created Blob URL here to revoke it before creating a new one
  // This prevents memory leaks from accumulated Blob URLs
  const lastBlobUrlRef = useRef<string | null>(null);

  // Cleanup Blob URL on unmount or when dialog closes
  useEffect(() => {
    return () => {
      // Cleanup on unmount: revoke any pending Blob URL
      if (lastBlobUrlRef.current) {
        URL.revokeObjectURL(lastBlobUrlRef.current);
        lastBlobUrlRef.current = null;
      }
    };
  }, []);

  // Also cleanup when dialog closes
  useEffect(() => {
    if (!open && lastBlobUrlRef.current) {
      URL.revokeObjectURL(lastBlobUrlRef.current);
      lastBlobUrlRef.current = null;
    }
  }, [open]);

  // Update speed when transport mode changes
  const handleTransportModeChange = (mode: ReportConfig['transportMode']) => {
    setTransportMode(mode);
    setSpeedKmh(SPEED_DEFAULTS[mode]);
  };

  // Build payload with current config
  const buildPayload = useCallback((): ReportPayload => {
    return buildReportPayload(
      { hotel_name: projectName, city: projectCity },
      trace,
      markers,
      { transportMode, speedKmh, playersCount }
    );
  }, [projectName, projectCity, trace, markers, transportMode, speedKmh, playersCount]);

  // Helper to create Blob URL and manage cleanup
  const createBlobUrl = (content: string, type: string): string => {
    // Revoke previous Blob URL before creating new one
    if (lastBlobUrlRef.current) {
      URL.revokeObjectURL(lastBlobUrlRef.current);
    }
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    lastBlobUrlRef.current = url;
    return url;
  };

  // Open report in new tab
  const handleOpenReport = () => {
    const payload = buildPayload();
    const html = generateInteractiveReportHTML(payload, { autoPrint: false });
    const url = createBlobUrl(html, 'text/html');
    window.open(url, '_blank');
  };

  // Export PDF (open with autoPrint)
  const handleExportPDF = () => {
    const payload = buildPayload();
    const html = generateInteractiveReportHTML(payload, { autoPrint: true });
    const url = createBlobUrl(html, 'text/html');
    window.open(url, '_blank');
  };

  // Export Word (.doc)
  const handleExportWord = () => {
    const payload = buildPayload();
    const html = generateWordExportHTML(payload);
    const filename = `rapport-${projectName.replace(/\s+/g, '_')}.doc`;
    downloadTextFile(filename, 'application/msword', html);
  };

  // Download HTML
  const handleDownloadHTML = () => {
    const payload = buildPayload();
    const html = generateInteractiveReportHTML(payload, { autoPrint: false });
    const filename = `rapport-${projectName.replace(/\s+/g, '_')}.html`;
    downloadTextFile(filename, 'text/html', html);
  };

  // Download JSON
  const handleDownloadJSON = () => {
    const payload = buildPayload();
    const json = JSON.stringify(payload, null, 2);
    const filename = `rapport-${projectName.replace(/\s+/g, '_')}.json`;
    downloadTextFile(filename, 'application/json', json);
  };

  // Compute summary stats
  const payload = buildPayload();
  const formatDistance = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Rapport Interactif
          </DialogTitle>
          <DialogDescription>
            Générez un rapport visuel pour le parcours avec carte, POIs et calculs de temps.
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        <Card className="bg-muted/50">
          <CardContent className="py-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
                  <Route className="w-3 h-3" />
                  Distance
                </div>
                <div className="font-semibold">{formatDistance(payload.trace.totalDistanceM)}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
                  <MapPin className="w-3 h-3" />
                  Marqueurs
                </div>
                <div className="font-semibold">{payload.pois.length}</div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-center gap-1 text-muted-foreground text-xs">
                  <Clock className="w-3 h-3" />
                  Temps total
                </div>
                <div className="font-semibold">{Math.round(payload.computed.totalMinutes)} min</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Config Panel */}
        <div className="space-y-4">
          <Label className="text-sm font-medium">Configuration</Label>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="transport" className="text-xs text-muted-foreground">
                Transport
              </Label>
              <Select value={transportMode} onValueChange={handleTransportModeChange}>
                <SelectTrigger id="transport" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walking">🚶 Marche</SelectItem>
                  <SelectItem value="scooter">🛵 Scooter</SelectItem>
                  <SelectItem value="car">🚗 Voiture</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="speed" className="text-xs text-muted-foreground">
                Vitesse (km/h)
              </Label>
              <Input
                id="speed"
                type="number"
                min={1}
                max={120}
                value={speedKmh}
                onChange={(e) => setSpeedKmh(Number(e.target.value) || 1)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="players" className="text-xs text-muted-foreground">
                Joueurs
              </Label>
              <Input
                id="players"
                type="number"
                min={1}
                max={100}
                value={playersCount}
                onChange={(e) => setPlayersCount(Number(e.target.value) || 1)}
                className="h-9"
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="space-y-3">
          {/* Primary action: Open report */}
          <Button onClick={handleOpenReport} className="w-full gap-2">
            <ExternalLink className="w-4 h-4" />
            Ouvrir le rapport
          </Button>

          {/* Export buttons grid */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={handleExportPDF} className="gap-2">
              <Printer className="w-4 h-4" />
              Export PDF
            </Button>
            <Button variant="outline" onClick={handleExportWord} className="gap-2">
              <FileText className="w-4 h-4" />
              Export Word
            </Button>
            <Button variant="outline" onClick={handleDownloadHTML} className="gap-2">
              <FileCode className="w-4 h-4" />
              Télécharger HTML
            </Button>
            <Button variant="outline" onClick={handleDownloadJSON} className="gap-2">
              <FileJson className="w-4 h-4" />
              Télécharger JSON
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
