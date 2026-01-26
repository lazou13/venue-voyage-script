import { useState } from 'react';
import { Plus, Trash2, GripVertical, Camera, Wifi, Ban } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { usePOIs } from '@/hooks/usePOIs';
import { useZones } from '@/hooks/useZones';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import type { POI, InteractionType, RiskLevel, WifiStrength } from '@/types/intake';
import { INTERACTION_LABELS, RISK_LABELS, WIFI_LABELS } from '@/types/intake';

interface FieldworkStepProps {
  projectId: string;
}

export function FieldworkStep({ projectId }: FieldworkStepProps) {
  const { pois, wifiZones, forbiddenZones } = useProject(projectId);
  const { addPOI, updatePOI, deletePOI } = usePOIs(projectId);
  const {
    addWifiZone,
    updateWifiZone,
    deleteWifiZone,
    addForbiddenZone,
    deleteForbiddenZone,
  } = useZones(projectId);
  const { uploadFile, isUploading } = useFileUpload();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newWifiZone, setNewWifiZone] = useState('');
  const [newForbiddenZone, setNewForbiddenZone] = useState('');
  const [newForbiddenReason, setNewForbiddenReason] = useState('');

  const handleAddPOI = () => {
    addPOI.mutate(
      {
        name: `Étape ${pois.length + 1}`,
        zone: '',
        photo_url: null,
        interaction: 'puzzle',
        risk: 'low',
        minutes_from_prev: 5,
        notes: null,
        sort_order: pois.length,
        step_config: {},
      },
      {
        onSuccess: (data) => {
          setEditingId(data.id);
          toast({ title: 'Étape ajoutée' });
        },
      }
    );
  };

  const handlePhotoUpload = async (poiId: string, file: File) => {
    try {
      const url = await uploadFile(file, `pois/${projectId}`);
      await updatePOI.mutateAsync({ id: poiId, photo_url: url });
      toast({ title: 'Photo uploadée' });
    } catch {
      toast({ title: 'Erreur upload', variant: 'destructive' });
    }
  };

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
      {/* POIs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Étapes / Points d'Intérêt</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {pois.length}/10 minimum
            </p>
          </div>
          <Button onClick={handleAddPOI} disabled={addPOI.isPending}>
            <Plus className="w-4 h-4 mr-1" />
            Ajouter
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {pois.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Aucune étape définie</p>
              <p className="text-sm">Ajoutez au moins 10 étapes</p>
            </div>
          ) : (
            pois.map((poi, index) => (
              <POICard
                key={poi.id}
                poi={poi}
                index={index}
                isEditing={editingId === poi.id}
                onEdit={() => setEditingId(editingId === poi.id ? null : poi.id)}
                onUpdate={(updates) => updatePOI.mutate({ id: poi.id, ...updates })}
                onDelete={() => deletePOI.mutate(poi.id)}
                onPhotoUpload={(file) => handlePhotoUpload(poi.id, file)}
                isUploading={isUploading}
              />
            ))
          )}
        </CardContent>
      </Card>

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
                    <SelectTrigger className="w-24 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
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

interface POICardProps {
  poi: POI;
  index: number;
  isEditing: boolean;
  onEdit: () => void;
  onUpdate: (updates: Partial<POI>) => void;
  onDelete: () => void;
  onPhotoUpload: (file: File) => void;
  isUploading: boolean;
}

function POICard({
  poi,
  index,
  isEditing,
  onEdit,
  onUpdate,
  onDelete,
  onPhotoUpload,
  isUploading,
}: POICardProps) {
  return (
    <div className="border rounded-lg p-3 bg-card">
      <div className="flex items-start gap-2">
        <GripVertical className="w-5 h-5 text-muted-foreground mt-1 cursor-grab" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
                #{index + 1}
              </span>
              {!isEditing && (
                <span className="font-medium truncate">{poi.name}</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={onEdit}>
                {isEditing ? 'Fermer' : 'Modifier'}
              </Button>
              <Button variant="ghost" size="icon" onClick={onDelete}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nom</Label>
                  <Input
                    value={poi.name}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    placeholder="Nom de l'étape"
                  />
                </div>
                <div>
                  <Label className="text-xs">Zone</Label>
                  <Input
                    value={poi.zone}
                    onChange={(e) => onUpdate({ zone: e.target.value })}
                    placeholder="Ex: Hall, Étage 2..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Interaction</Label>
                  <Select
                    value={poi.interaction}
                    onValueChange={(v) => onUpdate({ interaction: v as InteractionType })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {Object.entries(INTERACTION_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Risque</Label>
                  <Select
                    value={poi.risk}
                    onValueChange={(v) => onUpdate({ risk: v as RiskLevel })}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {Object.entries(RISK_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Minutes depuis précédent</Label>
                  <Input
                    type="number"
                    min={0}
                    value={poi.minutes_from_prev}
                    onChange={(e) => onUpdate({ minutes_from_prev: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Notes</Label>
                <Textarea
                  value={poi.notes || ''}
                  onChange={(e) => onUpdate({ notes: e.target.value })}
                  placeholder="Notes additionnelles..."
                  rows={2}
                />
              </div>

              <div>
                <Label className="text-xs">Photo</Label>
                {poi.photo_url ? (
                  <div className="relative mt-1">
                    <img
                      src={poi.photo_url}
                      alt={poi.name}
                      className="w-full h-24 object-cover rounded"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-1 right-1 h-6 w-6"
                      onClick={() => onUpdate({ photo_url: null })}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center h-16 border-2 border-dashed rounded cursor-pointer hover:bg-muted/50 mt-1">
                    <Camera className="w-5 h-5 text-muted-foreground mr-2" />
                    <span className="text-xs text-muted-foreground">
                      {isUploading ? 'Upload...' : 'Ajouter photo'}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onPhotoUpload(file);
                      }}
                      disabled={isUploading}
                    />
                  </label>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{poi.zone || 'Zone non définie'}</span>
              <span>•</span>
              <span>{INTERACTION_LABELS[poi.interaction]}</span>
              <span>•</span>
              <span>{RISK_LABELS[poi.risk]}</span>
              {poi.photo_url && (
                <>
                  <span>•</span>
                  <Camera className="w-3 h-3" />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
