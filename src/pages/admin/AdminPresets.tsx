import { useState } from 'react';
import { Loader2, Plus, Pencil, Trash2, GripVertical, Hotel, Map, Route, Star } from 'lucide-react';
import { useAppConfigContext } from '@/contexts/AppConfigContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

// Types
interface PresetDefaults {
  quest_config?: {
    quest_type?: string;
    play_mode?: string;
    estimated_minutes?: number;
    difficulty?: number;
  };
  step_defaults?: {
    final_step_type?: string;
    possible_validation_modes?: string[];
  };
}

interface Preset {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  order: number;
  filters?: {
    project_types?: string[];
    quest_types?: string[];
  };
  defaults: PresetDefaults;
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  hotel: Hotel,
  map: Map,
  route: Route,
  star: Star,
};

const ICON_OPTIONS = ['hotel', 'map', 'route', 'star'];

const DEFAULT_PRESET: Omit<Preset, 'id'> = {
  name: '',
  description: '',
  icon: 'star',
  enabled: true,
  order: 100,
  filters: { project_types: [], quest_types: [] },
  defaults: {
    quest_config: { quest_type: 'sequential', play_mode: 'solo', estimated_minutes: 60, difficulty: 2 },
    step_defaults: { final_step_type: 'mcq', possible_validation_modes: ['qr_code'] },
  },
};

export default function AdminPresets() {
  const { draftPayload, isLoading, updateDraft } = useAppConfigContext();
  const { toast } = useToast();
  
  const [editingPreset, setEditingPreset] = useState<Preset | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [defaultsJson, setDefaultsJson] = useState('');

  const presets: Preset[] = ((draftPayload as unknown as Record<string, unknown>)?.presets as Preset[] | undefined) || [];

  const handleAddPreset = () => {
    const newPreset: Preset = {
      ...DEFAULT_PRESET,
      id: `preset_${Date.now()}`,
    };
    setEditingPreset(newPreset);
    setDefaultsJson(JSON.stringify(newPreset.defaults, null, 2));
    setJsonError(null);
    setIsDialogOpen(true);
  };

  const handleEditPreset = (preset: Preset) => {
    setEditingPreset({ ...preset });
    setDefaultsJson(JSON.stringify(preset.defaults, null, 2));
    setJsonError(null);
    setIsDialogOpen(true);
  };

  const handleSavePreset = () => {
    if (!editingPreset) return;
    
    // Validate ID
    if (!/^[a-z][a-z0-9_]*$/.test(editingPreset.id)) {
      toast({ title: 'Erreur', description: 'ID invalide (snake_case requis)', variant: 'destructive' });
      return;
    }
    
    // Validate JSON
    try {
      const parsedDefaults = JSON.parse(defaultsJson);
      editingPreset.defaults = parsedDefaults;
    } catch (e) {
      setJsonError('JSON invalide');
      return;
    }
    
    updateDraft((prev) => {
      const currentPresets: Preset[] = ((prev as unknown as Record<string, unknown>).presets as Preset[] | undefined) || [];
      const existingIndex = currentPresets.findIndex(p => p.id === editingPreset.id);

      let newPresets: Preset[];
      if (existingIndex >= 0) {
        newPresets = [...currentPresets];
        newPresets[existingIndex] = editingPreset;
      } else {
        newPresets = [...currentPresets, editingPreset];
      }

      return { ...prev, presets: newPresets } as typeof prev;
    });
    
    setIsDialogOpen(false);
    setEditingPreset(null);
    toast({ title: 'Préréglage sauvegardé' });
  };

  const handleDeletePreset = (presetId: string) => {
    if (!confirm('Supprimer ce préréglage ?')) return;
    
    updateDraft((prev) => {
      const currentPresets: Preset[] = ((prev as unknown as Record<string, unknown>).presets as Preset[] | undefined) || [];
      return { ...prev, presets: currentPresets.filter(p => p.id !== presetId) } as typeof prev;
    });
    
    toast({ title: 'Préréglage supprimé' });
  };

  const handleToggleEnabled = (presetId: string, enabled: boolean) => {
    updateDraft((prev) => {
      const currentPresets: Preset[] = ((prev as unknown as Record<string, unknown>).presets as Preset[] | undefined) || [];
      return {
        ...prev,
        presets: currentPresets.map(p => p.id === presetId ? { ...p, enabled } : p),
      } as typeof prev;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Préréglages</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configurez les templates de quête prédéfinis.
          </p>
        </div>
        <Button onClick={handleAddPreset} size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Ajouter
        </Button>
      </div>

      {presets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Aucun préréglage configuré.</p>
            <Button onClick={handleAddPreset} variant="outline" className="mt-4">
              <Plus className="w-4 h-4 mr-2" />
              Créer le premier
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {presets
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((preset) => {
              const IconComponent = ICON_MAP[preset.icon] || Star;
              return (
                <Card key={preset.id} className={!preset.enabled ? 'opacity-50' : ''}>
                  <CardHeader className="py-4 px-4">
                    <div className="flex items-center gap-4">
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <IconComponent className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base flex items-center gap-2">
                          {preset.name || preset.id}
                          <Badge variant="outline" className="text-xs font-mono">
                            {preset.id}
                          </Badge>
                        </CardTitle>
                        <CardDescription className="truncate">
                          {preset.description || 'Pas de description'}
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={preset.enabled}
                          onCheckedChange={(checked) => handleToggleEnabled(preset.id, checked)}
                        />
                        <Button variant="ghost" size="icon" onClick={() => handleEditPreset(preset)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeletePreset(preset.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPreset && presets.some(p => p.id === editingPreset.id) ? 'Modifier' : 'Nouveau'} préréglage
            </DialogTitle>
            <DialogDescription>
              Configurez les paramètres par défaut appliqués lors de la sélection de ce préréglage.
            </DialogDescription>
          </DialogHeader>

          {editingPreset && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="preset-id">ID (snake_case)</Label>
                  <Input
                    id="preset-id"
                    value={editingPreset.id}
                    onChange={(e) => setEditingPreset({ ...editingPreset, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                    placeholder="hotel_indoor"
                    className="font-mono"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="preset-icon">Icône</Label>
                  <select
                    id="preset-icon"
                    value={editingPreset.icon}
                    onChange={(e) => setEditingPreset({ ...editingPreset, icon: e.target.value })}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {ICON_OPTIONS.map(icon => (
                      <option key={icon} value={icon}>{icon}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="preset-name">Nom</Label>
                <Input
                  id="preset-name"
                  value={editingPreset.name}
                  onChange={(e) => setEditingPreset({ ...editingPreset, name: e.target.value })}
                  placeholder="Hôtel intérieur"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preset-description">Description</Label>
                <Input
                  id="preset-description"
                  value={editingPreset.description}
                  onChange={(e) => setEditingPreset({ ...editingPreset, description: e.target.value })}
                  placeholder="Chasse au trésor indoor pour hôtels"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preset-order">Ordre d'affichage</Label>
                <Input
                  id="preset-order"
                  type="number"
                  value={editingPreset.order}
                  onChange={(e) => setEditingPreset({ ...editingPreset, order: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preset-defaults">Defaults (JSON)</Label>
                <Textarea
                  id="preset-defaults"
                  value={defaultsJson}
                  onChange={(e) => {
                    setDefaultsJson(e.target.value);
                    setJsonError(null);
                  }}
                  className="font-mono text-xs min-h-[200px]"
                  placeholder='{"quest_config": {...}, "step_defaults": {...}}'
                />
                {jsonError && (
                  <p className="text-sm text-destructive">{jsonError}</p>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSavePreset}>
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
