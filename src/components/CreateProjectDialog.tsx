import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, MapPin, Route, Plus, Loader2, Library } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCapabilities } from '@/hooks/useCapabilities';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  establishment: <Building2 className="w-6 h-6" />,
  tourist_spot: <MapPin className="w-6 h-6" />,
  route_recon: <Route className="w-6 h-6" />,
};

const DEFAULT_ICON = <Plus className="w-6 h-6" />;

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectDialog({ open, onOpenChange }: CreateProjectDialogProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { capabilities } = useCapabilities();
  const [selectedType, setSelectedType] = useState<string>('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const projectTypes = capabilities?.enums?.project_types || [];

  const selectedTypeData = projectTypes.find(t => t.id === selectedType);
  const nameLabel = selectedTypeData?.name_label || 'Nom du projet';

  const handleCreate = async () => {
    if (!selectedType || !name.trim() || !city.trim()) return;
    setIsCreating(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          hotel_name: name.trim(),
          city: city.trim(),
          floors: 1,
          quest_config: { project_type: selectedType },
        })
        .select()
        .single();
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      onOpenChange(false);
      setSelectedType('');
      setName('');
      setCity('');
      navigate(`/intake/${data.id}`);
    } catch (e) {
      console.error('Failed to create project:', e);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau Projet</DialogTitle>
          <DialogDescription>
            Choisissez le type de projet et donnez-lui un nom.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Type selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Type de projet</Label>
            <div className="grid grid-cols-2 gap-2">
              {projectTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedType(type.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left",
                    selectedType === type.id
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                    selectedType === type.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}>
                    {TYPE_ICONS[type.id] || DEFAULT_ICON}
                  </div>
                  <span className="text-sm font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="project-name" className="text-sm font-medium">{nameLabel}</Label>
            <Input
              id="project-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={nameLabel + '...'}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>

          {/* City */}
          <div className="space-y-1.5">
            <Label htmlFor="project-city" className="text-sm font-medium">Ville / Lieu</Label>
            <Input
              id="project-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Paris, Marrakech, Dubaï..."
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>

          {/* Create button */}
          <Button
            onClick={handleCreate}
            disabled={!selectedType || !name.trim() || !city.trim() || isCreating}
            className="w-full rounded-full gap-2"
          >
            {isCreating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Créer le projet
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
