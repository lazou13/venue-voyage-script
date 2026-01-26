import { useState } from 'react';
import { Plus, Trash2, Wifi, Ban } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { useZones } from '@/hooks/useZones';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { WifiStrength } from '@/types/intake';
import { WIFI_LABELS } from '@/types/intake';

interface ZonesStepProps {
  projectId: string;
}

export function ZonesStep({ projectId }: ZonesStepProps) {
  const { wifiZones, forbiddenZones } = useProject(projectId);
  const {
    addWifiZone,
    updateWifiZone,
    deleteWifiZone,
    addForbiddenZone,
    updateForbiddenZone,
    deleteForbiddenZone,
  } = useZones(projectId);
  const { toast } = useToast();

  const [newWifiZone, setNewWifiZone] = useState('');
  const [newForbiddenZone, setNewForbiddenZone] = useState('');
  const [newForbiddenReason, setNewForbiddenReason] = useState('');

  const handleAddWifiZone = () => {
    if (!newWifiZone.trim()) return;
    addWifiZone.mutate(
      { zone: newWifiZone.trim(), strength: 'ok' },
      {
        onSuccess: () => {
          setNewWifiZone('');
          toast({ title: 'Zone Wi-Fi ajoutée' });
        },
      }
    );
  };

  const handleAddForbiddenZone = () => {
    if (!newForbiddenZone.trim()) return;
    addForbiddenZone.mutate(
      { zone: newForbiddenZone.trim(), reason: newForbiddenReason.trim() || null },
      {
        onSuccess: () => {
          setNewForbiddenZone('');
          setNewForbiddenReason('');
          toast({ title: 'Zone interdite ajoutée' });
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Wi-Fi Zones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5" />
            Couverture Wi-Fi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newWifiZone}
              onChange={(e) => setNewWifiZone(e.target.value)}
              placeholder="Nom de la zone"
              className="flex-1"
            />
            <Button onClick={handleAddWifiZone} disabled={addWifiZone.isPending}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {wifiZones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Aucune zone Wi-Fi définie
            </p>
          ) : (
            <div className="space-y-2">
              {wifiZones.map((wz) => (
                <div key={wz.id} className="flex items-center gap-2 p-2 border rounded">
                  <span className="flex-1 text-sm">{wz.zone}</span>
                  <Select
                    value={wz.strength}
                    onValueChange={(v) =>
                      updateWifiZone.mutate({ id: wz.id, strength: v as WifiStrength })
                    }
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(WIFI_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteWifiZone.mutate(wz.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Forbidden Zones */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Ban className="w-5 h-5 text-destructive" />
            Zones Interdites
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={newForbiddenZone}
                onChange={(e) => setNewForbiddenZone(e.target.value)}
                placeholder="Nom de la zone"
                className="flex-1"
              />
              <Button onClick={handleAddForbiddenZone} disabled={addForbiddenZone.isPending}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <Input
              value={newForbiddenReason}
              onChange={(e) => setNewForbiddenReason(e.target.value)}
              placeholder="Raison (optionnel)"
            />
          </div>

          {forbiddenZones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              ⚠️ Définissez au moins une zone interdite
            </p>
          ) : (
            <div className="space-y-2">
              {forbiddenZones.map((fz) => (
                <div key={fz.id} className="flex items-center gap-2 p-2 border border-destructive/30 rounded bg-destructive/5">
                  <div className="flex-1">
                    <span className="text-sm font-medium">{fz.zone}</span>
                    {fz.reason && (
                      <p className="text-xs text-muted-foreground">{fz.reason}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteForbiddenZone.mutate(fz.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
