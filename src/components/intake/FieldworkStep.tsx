import { useState } from 'react';
import { Plus, Trash2, GripVertical, Camera, Wifi, Ban, MapPin, Sparkles, Library } from 'lucide-react';
import { useCrossTabStats } from '@/hooks/useCrossTabStats';
import { CrossTabSummary } from './CrossTabSummary';
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
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { EnumCheckboxGroup } from './shared/EnumCheckboxGroup';
import { MedinaPOIImporter } from './MedinaPOIImporter';
import { cn } from '@/lib/utils';
import type { POI, InteractionType, RiskLevel, WifiStrength, StepType, ValidationMode } from '@/types/intake';
import { INTERACTION_LABELS, RISK_LABELS, WIFI_LABELS, STEP_TYPE_LABELS, VALIDATION_MODE_LABELS } from '@/types/intake';

interface FieldworkStepProps {
  projectId: string;
  onNavigate?: (tab: string) => void;
}

export function FieldworkStep({ projectId, onNavigate }: FieldworkStepProps) {
  const { project, pois, wifiZones, forbiddenZones, traces } = useProject(projectId);
  const stats = useCrossTabStats(project, pois, traces);
  const { addPOI, updatePOI, deletePOI, importFromMedina } = usePOIs(projectId);
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
  const [importerOpen, setImporterOpen] = useState(false);

  const handleImportFromMedina = async (medinaPoiId: string, attachMedia: boolean, selectedMediaIds?: string[]) => {
    try {
      const data = await importFromMedina.mutateAsync({ medinaPoiId, attachMedia, selectedMediaIds });
      setEditingId(data.id);
      toast({ title: '📦 POI importé depuis la bibliothèque' });
    } catch (err: any) {
      toast({ title: 'Erreur import', description: err.message, variant: 'destructive' });
    }
  };

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
          toast({ title: '✨ Étape ajoutée' });
        },
      }
    );
  };

  const handlePhotoUpload = async (poiId: string, file: File) => {
    try {
      const url = await uploadFile(file, `pois/${projectId}`);
      await updatePOI.mutateAsync({ id: poiId, photo_url: url });
      toast({ title: '📸 Photo uploadée' });
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
          toast({ title: '📶 Zone Wi-Fi ajoutée' });
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
          toast({ title: '🚫 Zone interdite ajoutée' });
        },
      }
    );
  };

  const progressPercent = Math.min(100, (pois.length / 10) * 100);

  return (
    <div className="space-y-6">
      <CrossTabSummary tab="terrain" stats={stats} onNavigate={onNavigate} />
      <Card className="overflow-hidden border-border/60 shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between bg-muted/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Étapes / Points d'Intérêt</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      progressPercent >= 100 ? "bg-success" : "bg-primary"
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span className={cn(
                  "text-xs font-medium",
                  progressPercent >= 100 ? "text-success" : "text-muted-foreground"
                )}>
                  {pois.length}/10
                </span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setImporterOpen(true)}
              className="rounded-full gap-2 shadow-soft"
            >
              <Library className="w-4 h-4" />
              <span className="hidden sm:inline">Bibliothèque</span>
            </Button>
            <Button 
              onClick={handleAddPOI} 
              disabled={addPOI.isPending}
              className="rounded-full gap-2 shadow-soft"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Ajouter</span>
            </Button>
          </div>
        </CardHeader>

        {/* Medina POI Importer Dialog */}
        <MedinaPOIImporter
          open={importerOpen}
          onOpenChange={setImporterOpen}
          onImport={handleImportFromMedina}
          isImporting={importFromMedina.isPending}
        />
        <CardContent className="space-y-3 pt-4">
          {pois.length === 0 ? (
            <div className="text-center py-12 animate-fade-in">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <p className="text-foreground font-medium mb-1">Aucune étape définie</p>
              <p className="text-sm text-muted-foreground">Ajoutez au moins 10 étapes pour une expérience complète</p>
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
      <Card className="overflow-hidden border-border/60 shadow-soft">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-info" />
            </div>
            Couverture Wi-Fi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="flex gap-2">
            <Input
              value={newWifiZone}
              onChange={(e) => setNewWifiZone(e.target.value)}
              placeholder="Nom de la zone"
              className="flex-1 rounded-xl"
            />
            <Button 
              onClick={handleAddWifiZone} 
              disabled={addWifiZone.isPending}
              className="rounded-xl"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {wifiZones.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Aucune zone Wi-Fi définie
            </p>
          ) : (
            <div className="space-y-2">
              {wifiZones.map((wz) => (
                <div key={wz.id} className="flex items-center gap-2 p-3 border border-border/60 rounded-xl bg-background hover:bg-muted/30 transition-colors">
                  <span className="flex-1 text-sm font-medium">{wz.zone}</span>
                  <Select
                    value={wz.strength}
                    onValueChange={(v) =>
                      updateWifiZone.mutate({ id: wz.id, strength: v as WifiStrength })
                    }
                  >
                    <SelectTrigger className="w-28 bg-background rounded-lg">
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
                    className="h-8 w-8 rounded-lg"
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
      <Card className="overflow-hidden border-border/60 shadow-soft">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="flex items-center gap-3 text-lg">
            <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
              <Ban className="w-5 h-5 text-destructive" />
            </div>
            Zones Interdites
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={newForbiddenZone}
                onChange={(e) => setNewForbiddenZone(e.target.value)}
                placeholder="Nom de la zone"
                className="flex-1 rounded-xl"
              />
              <Button 
                onClick={handleAddForbiddenZone} 
                disabled={addForbiddenZone.isPending}
                className="rounded-xl"
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <Input
              value={newForbiddenReason}
              onChange={(e) => setNewForbiddenReason(e.target.value)}
              placeholder="Raison (optionnel)"
              className="rounded-xl"
            />
          </div>

          {forbiddenZones.length === 0 ? (
            <div className="text-center py-6 bg-warning/5 rounded-xl border border-warning/20">
              <p className="text-sm text-warning font-medium">⚠️ Définissez au moins une zone interdite</p>
            </div>
          ) : (
            <div className="space-y-2">
              {forbiddenZones.map((fz) => (
                <div key={fz.id} className="flex items-center gap-2 p-3 border border-destructive/20 rounded-xl bg-destructive/5 hover:bg-destructive/10 transition-colors">
                  <div className="flex-1">
                    <span className="text-sm font-medium">{fz.zone}</span>
                    {fz.reason && (
                      <p className="text-xs text-muted-foreground mt-0.5">{fz.reason}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg"
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
    <div className={cn(
      "border rounded-2xl p-4 bg-card transition-all animate-fade-in",
      isEditing ? "border-primary/30 shadow-soft" : "border-border/60 hover:border-primary/20"
    )}>
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1">
          <GripVertical className="w-5 h-5 text-muted-foreground/50 cursor-grab" />
          <Badge variant="secondary" className="rounded-lg text-xs font-bold px-2">
            {index + 1}
          </Badge>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {!isEditing && (
                <span className="font-semibold truncate">{poi.name}</span>
              )}
              {poi.photo_url && !isEditing && (
                <Camera className="w-4 h-4 text-muted-foreground shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button 
                variant={isEditing ? "default" : "ghost"} 
                size="sm" 
                onClick={onEdit}
                className="rounded-lg text-xs"
              >
                {isEditing ? 'Fermer' : 'Modifier'}
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={onDelete}
                className="h-8 w-8 rounded-lg"
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>

          {isEditing ? (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Nom</Label>
                  <Input
                    value={poi.name}
                    onChange={(e) => onUpdate({ name: e.target.value })}
                    placeholder="Nom de l'étape"
                    className="rounded-lg"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Zone</Label>
                  <Input
                    value={poi.zone}
                    onChange={(e) => onUpdate({ zone: e.target.value })}
                    placeholder="Ex: Hall, Étage 2..."
                    className="rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Type d'étape</Label>
                  <Select
                    value={(poi.step_config as any)?.final_step_type || ''}
                    onValueChange={(v) => onUpdate({ 
                      step_config: { 
                        ...(poi.step_config as any), 
                        final_step_type: v as StepType 
                      } 
                    })}
                  >
                    <SelectTrigger className="bg-background rounded-lg">
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent className="bg-popover z-50">
                      {Object.entries(STEP_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-medium mb-1.5 block">Risque</Label>
                  <Select
                    value={poi.risk}
                    onValueChange={(v) => onUpdate({ risk: v as RiskLevel })}
                  >
                    <SelectTrigger className="bg-background rounded-lg">
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
                  <Label className="text-xs font-medium mb-1.5 block">Minutes</Label>
                  <Input
                    type="number"
                    min={0}
                    value={poi.minutes_from_prev}
                    onChange={(e) => onUpdate({ minutes_from_prev: parseInt(e.target.value) || 0 })}
                    className="rounded-lg"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium mb-1.5 block">Notes</Label>
                <Textarea
                  value={poi.notes || ''}
                  onChange={(e) => onUpdate({ notes: e.target.value })}
                  placeholder="Notes additionnelles..."
                  rows={2}
                  className="rounded-lg"
                />
              </div>

              <div>
                <Label className="text-xs font-medium mb-1.5 block">Photo</Label>
                {poi.photo_url ? (
                  <div className="relative mt-1">
                    <img
                      src={poi.photo_url}
                      alt={poi.name}
                      className="w-full h-28 object-cover rounded-xl"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 rounded-lg"
                      onClick={() => onUpdate({ photo_url: null })}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center h-20 border-2 border-dashed border-border/60 rounded-xl cursor-pointer hover:bg-muted/30 hover:border-primary/30 transition-colors mt-1">
                    <Camera className="w-5 h-5 text-muted-foreground mr-2" />
                    <span className="text-sm text-muted-foreground">
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

              {/* Multi-select: Step Types */}
              <EnumCheckboxGroup<StepType>
                label="Possibilités d'étape"
                values={(poi.step_config as any)?.possible_step_types || []}
                onChange={(values) => onUpdate({ 
                  step_config: { 
                    ...(poi.step_config as any), 
                    possible_step_types: values 
                  } 
                })}
                options={STEP_TYPE_LABELS}
              />

              {/* Multi-select: Validation Modes */}
              <EnumCheckboxGroup<ValidationMode>
                label="Possibilités de validation"
                values={(poi.step_config as any)?.possible_validation_modes || []}
                onChange={(values) => onUpdate({ 
                  step_config: { 
                    ...(poi.step_config as any), 
                    possible_validation_modes: values 
                  } 
                })}
                options={VALIDATION_MODE_LABELS}
              />
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline" className="rounded-lg font-normal">
                {poi.zone || 'Zone non définie'}
              </Badge>
              <Badge variant="outline" className="rounded-lg font-normal">
                {STEP_TYPE_LABELS[(poi.step_config as any)?.final_step_type as StepType] || INTERACTION_LABELS[poi.interaction] || 'Non défini'}
              </Badge>
              <Badge 
                variant="outline" 
                className={cn(
                  "rounded-lg font-normal",
                  poi.risk === 'high' && "border-destructive/30 text-destructive",
                  poi.risk === 'medium' && "border-warning/30 text-warning"
                )}
              >
                {RISK_LABELS[poi.risk]}
              </Badge>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
