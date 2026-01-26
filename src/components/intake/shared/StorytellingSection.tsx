import { useState, useRef, useMemo, useCallback } from 'react';
import { User, Plus, X, Check, Upload, Search, Package } from 'lucide-react';
import avatarPlaceholder from '@/assets/avatar-placeholder.webp';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useProject } from '@/hooks/useProject';
import { useAvatars } from '@/hooks/useAvatars';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useToast } from '@/hooks/use-toast';
import type {
  Avatar,
  AvatarStyle,
  AvatarAge,
  AvatarPersona,
  AvatarOutfit,
  StorytellingConfig,
} from '@/types/intake';
import {
  AVATAR_STYLE_LABELS,
  AVATAR_AGE_LABELS,
  AVATAR_PERSONA_LABELS,
  AVATAR_OUTFIT_LABELS,
} from '@/types/intake';

interface StorytellingSectionProps {
  projectId: string;
}

const AVATAR_STYLES: AvatarStyle[] = ['cartoon', 'realistic', 'semi_realistic', 'anime', 'minimal'];
const AVATAR_AGES: AvatarAge[] = ['child', 'teen', 'adult', 'senior'];
const AVATAR_PERSONAS: AvatarPersona[] = ['guide_host', 'detective', 'explorer', 'historian', 'local_character', 'mascot', 'ai_assistant', 'villain_light'];
const AVATAR_OUTFITS: AvatarOutfit[] = ['traditional', 'modern', 'luxury', 'adventure'];

export function StorytellingSection({ projectId }: StorytellingSectionProps) {
  const { project, updateProject } = useProject(projectId);
  const { avatars, addAvatar, deleteAvatar, seedPlaceholderAvatars, isSeeding } = useAvatars(projectId);
  const { uploadFile, isUploading } = useFileUpload();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingAvatarId, setPendingAvatarId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStyle, setFilterStyle] = useState<AvatarStyle | 'all'>('all');
  const [filterPersona, setFilterPersona] = useState<AvatarPersona | 'all'>('all');
  const [filterAge, setFilterAge] = useState<AvatarAge | 'all'>('all');
  const [formData, setFormData] = useState({
    name: '',
    style: 'cartoon' as AvatarStyle,
    age: 'adult' as AvatarAge,
    persona: 'guide_host' as AvatarPersona,
    outfit: 'modern' as AvatarOutfit,
    scope: 'global' as 'global' | 'project',
    imageUrl: '',
  });

  const questConfig = project?.quest_config || {};
  const storytelling = questConfig.storytelling || { enabled: false };
  const narratorAvatarId = storytelling.narrator?.avatar_id;

  // Split avatars by scope
  const globalAvatars = useMemo(() => avatars.filter(a => a.project_id === null), [avatars]);
  const projectAvatars = useMemo(() => avatars.filter(a => a.project_id === projectId), [avatars, projectId]);

  // Filter avatars client-side
  const filterAvatars = (list: Avatar[]) => {
    return list.filter(avatar => {
      const matchesSearch = !searchQuery || avatar.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStyle = filterStyle === 'all' || avatar.style === filterStyle;
      const matchesPersona = filterPersona === 'all' || avatar.persona === filterPersona;
      const matchesAge = filterAge === 'all' || avatar.age === filterAge;
      return matchesSearch && matchesStyle && matchesPersona && matchesAge;
    });
  };

  const filteredGlobalAvatars = useMemo(() => filterAvatars(globalAvatars), [globalAvatars, searchQuery, filterStyle, filterPersona, filterAge]);
  const filteredProjectAvatars = useMemo(() => filterAvatars(projectAvatars), [projectAvatars, searchQuery, filterStyle, filterPersona, filterAge]);

  const updateStorytelling = (updates: Partial<StorytellingConfig>) => {
    updateProject.mutate({
      quest_config: {
        ...questConfig,
        storytelling: { ...storytelling, ...updates },
      },
    });
  };

  const handleToggle = (enabled: boolean) => {
    updateStorytelling({ enabled });
  };

  const handleSelectAvatar = (avatarId: string) => {
    // If already selected, do nothing
    if (avatarId === narratorAvatarId) return;

    // If a narrator is already selected, show confirmation
    if (narratorAvatarId) {
      setPendingAvatarId(avatarId);
      setConfirmDialogOpen(true);
    } else {
      // Direct selection
      updateStorytelling({
        enabled: true,
        narrator: { avatar_id: avatarId },
      });
    }
  };

  const handleConfirmChange = () => {
    if (pendingAvatarId) {
      updateStorytelling({
        enabled: true,
        narrator: { avatar_id: pendingAvatarId },
      });
    }
    setConfirmDialogOpen(false);
    setPendingAvatarId(null);
  };

  const handleCancelChange = () => {
    setConfirmDialogOpen(false);
    setPendingAvatarId(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = await uploadFile(file, `avatars/${projectId}`);
    if (url) {
      setFormData((prev) => ({ ...prev, imageUrl: url }));
    }
  };

  const handleSaveAvatar = async () => {
    if (!formData.name.trim() || !formData.imageUrl) {
      toast({
        title: 'Erreur',
        description: 'Nom et image requis',
        variant: 'destructive',
      });
      return;
    }

    try {
      await addAvatar.mutateAsync({
        project_id: formData.scope === 'project' ? projectId : null,
        name: formData.name.trim(),
        style: formData.style,
        age: formData.age,
        persona: formData.persona,
        outfit: formData.outfit,
        image_url: formData.imageUrl,
      });
      toast({ title: 'Avatar ajouté' });
      setDialogOpen(false);
      setFormData({
        name: '',
        style: 'cartoon',
        age: 'adult',
        persona: 'guide_host',
        outfit: 'modern',
        scope: 'global',
        imageUrl: '',
      });
    } catch (err) {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'ajouter l\'avatar',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteAvatar = async (id: string) => {
    try {
      await deleteAvatar.mutateAsync(id);
      // Clear selection if deleted avatar was selected
      if (narratorAvatarId === id) {
        updateStorytelling({ narrator: { avatar_id: null } });
      }
      toast({ title: 'Avatar supprimé' });
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible de supprimer l\'avatar',
        variant: 'destructive',
      });
    }
  };

  const handleSeedAvatars = async () => {
    try {
      await seedPlaceholderAvatars.mutateAsync();
      toast({ title: '10 avatars placeholders ajoutés!' });
    } catch {
      toast({
        title: 'Erreur',
        description: 'Impossible d\'ajouter les avatars',
        variant: 'destructive',
      });
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterStyle('all');
    setFilterPersona('all');
    setFilterAge('all');
  };

  const hasFilters = searchQuery || filterStyle !== 'all' || filterPersona !== 'all' || filterAge !== 'all';

  // Avatar card renderer
  const renderAvatarCard = (avatar: Avatar) => {
    const isSelected = avatar.id === narratorAvatarId;
    return (
      <div
        key={avatar.id}
        onClick={() => storytelling.enabled && handleSelectAvatar(avatar.id)}
        className={`relative group rounded-lg border-2 p-2 transition-all ${
          storytelling.enabled ? 'cursor-pointer' : 'cursor-default opacity-75'
        } ${
          isSelected
            ? 'border-primary bg-primary/10'
            : 'border-border hover:border-primary/50 hover:bg-muted/50'
        }`}
      >
        {/* Narrator badge */}
        {isSelected && (
          <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] px-1.5 py-0 z-10">
            Narrateur
          </Badge>
        )}
        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground rounded-full p-1 z-10">
            <Check className="w-3 h-3" />
          </div>
        )}
        {/* Delete button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteAvatar(avatar.id);
          }}
          className="absolute top-1 right-1 bg-destructive/80 text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <X className="w-3 h-3" />
        </button>
        {/* "Set as narrator" button on hover (only if storytelling enabled and not already selected) */}
        {storytelling.enabled && !isSelected && (
          <Button
            variant="secondary"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleSelectAvatar(avatar.id);
            }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] px-2 py-0.5 h-auto z-10"
          >
            Définir narrateur
          </Button>
        )}
        {/* Avatar image with fallback */}
        <div className="aspect-square rounded-md overflow-hidden bg-muted mb-2">
          <img
            src={avatar.image_url}
            alt={avatar.name}
            loading="lazy"
            className="w-full h-full object-cover"
            onError={(e) => {
              // Prevent infinite loop - only swap if not already the placeholder
              if (e.currentTarget.src !== avatarPlaceholder) {
                e.currentTarget.src = avatarPlaceholder;
              }
            }}
          />
        </div>
        {/* Name */}
        <p className="text-xs font-medium truncate text-center">
          {avatar.name}
        </p>
        {/* Badges */}
        <div className="flex flex-wrap gap-1 mt-1 justify-center">
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {AVATAR_PERSONA_LABELS[avatar.persona]}
          </Badge>
          <Badge variant="secondary" className="text-[10px] px-1 py-0">
            {AVATAR_STYLE_LABELS[avatar.style]}
          </Badge>
        </div>
      </div>
    );
  };

  // Empty state component
  const EmptyState = () => (
    <div className="text-center py-8 space-y-4">
      <Package className="w-12 h-12 mx-auto text-muted-foreground/50" />
      <div>
        <p className="text-sm text-muted-foreground">Aucun avatar disponible.</p>
        <p className="text-xs text-muted-foreground mt-1">
          Commencez par importer le pack de 10 avatars placeholders ou ajoutez vos propres avatars.
        </p>
      </div>
      <Button
        variant="outline"
        onClick={handleSeedAvatars}
        disabled={isSeeding}
        className="mx-auto"
      >
        <Package className="w-4 h-4 mr-2" />
        {isSeeding ? 'Import en cours...' : 'Importer le pack de 10 avatars'}
      </Button>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <User className="w-5 h-5 text-primary" />
          Storytelling
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle */}
        <div className="flex items-center justify-between">
          <Label htmlFor="storytelling-toggle" className="cursor-pointer">
            Activer le storytelling
          </Label>
          <Switch
            id="storytelling-toggle"
            checked={storytelling.enabled}
            onCheckedChange={handleToggle}
          />
        </div>

        {/* Add Avatar Button - always visible */}
        <Button
          variant="outline"
          onClick={() => setDialogOpen(true)}
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" />
          Ajouter un avatar
        </Button>

        {/* Empty state */}
        {avatars.length === 0 && <EmptyState />}

        {/* Avatar Gallery with tabs (only show when avatars exist) */}
        {avatars.length > 0 && (
          <>
            {/* Search and Filters */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              {/* Filter chips */}
              <div className="flex flex-wrap gap-2">
                <Select value={filterStyle} onValueChange={(v) => setFilterStyle(v as AvatarStyle | 'all')}>
                  <SelectTrigger className="w-auto h-8 text-xs">
                    <SelectValue placeholder="Style" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous styles</SelectItem>
                    {AVATAR_STYLES.map(s => (
                      <SelectItem key={s} value={s}>{AVATAR_STYLE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={filterPersona} onValueChange={(v) => setFilterPersona(v as AvatarPersona | 'all')}>
                  <SelectTrigger className="w-auto h-8 text-xs">
                    <SelectValue placeholder="Persona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous personas</SelectItem>
                    {AVATAR_PERSONAS.map(p => (
                      <SelectItem key={p} value={p}>{AVATAR_PERSONA_LABELS[p]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Select value={filterAge} onValueChange={(v) => setFilterAge(v as AvatarAge | 'all')}>
                  <SelectTrigger className="w-auto h-8 text-xs">
                    <SelectValue placeholder="Âge" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous âges</SelectItem>
                    {AVATAR_AGES.map(a => (
                      <SelectItem key={a} value={a}>{AVATAR_AGE_LABELS[a]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {hasFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs">
                    Effacer filtres
                  </Button>
                )}
              </div>
            </div>

            {/* Tabs for global vs project avatars */}
            <Tabs defaultValue="library" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="library" className="text-xs">
                  Bibliothèque ({filteredGlobalAvatars.length})
                </TabsTrigger>
                <TabsTrigger value="project" className="text-xs">
                  Ce projet ({filteredProjectAvatars.length})
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="library" className="mt-3">
                {filteredGlobalAvatars.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {hasFilters ? 'Aucun avatar ne correspond aux filtres' : 'Aucun avatar global'}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {filteredGlobalAvatars.map(renderAvatarCard)}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="project" className="mt-3">
                {filteredProjectAvatars.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {hasFilters ? 'Aucun avatar ne correspond aux filtres' : 'Aucun avatar spécifique à ce projet'}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {filteredProjectAvatars.map(renderAvatarCard)}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* Validation hint */}
            {storytelling.enabled && !narratorAvatarId && (
              <p className="text-xs text-destructive">
                Sélectionnez un avatar narrateur pour valider
              </p>
            )}
          </>
        )}

        {/* Add Avatar Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Ajouter un avatar</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Image upload */}
              <div className="space-y-2">
                <Label>Image</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
                {formData.imageUrl ? (
                  <div className="relative w-24 h-24 mx-auto">
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData((p) => ({ ...p, imageUrl: '' }))}
                      className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="w-full"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {isUploading ? 'Upload...' : 'Choisir une image'}
                  </Button>
                )}
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label>Nom</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Ex: Luna, le guide mystérieux"
                />
              </div>

              {/* Style */}
              <div className="space-y-1.5">
                <Label>Style</Label>
                <Select
                  value={formData.style}
                  onValueChange={(v) => setFormData((p) => ({ ...p, style: v as AvatarStyle }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVATAR_STYLES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {AVATAR_STYLE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Persona */}
              <div className="space-y-1.5">
                <Label>Persona</Label>
                <Select
                  value={formData.persona}
                  onValueChange={(v) => setFormData((p) => ({ ...p, persona: v as AvatarPersona }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVATAR_PERSONAS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {AVATAR_PERSONA_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Age */}
              <div className="space-y-1.5">
                <Label>Âge</Label>
                <Select
                  value={formData.age}
                  onValueChange={(v) => setFormData((p) => ({ ...p, age: v as AvatarAge }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVATAR_AGES.map((a) => (
                      <SelectItem key={a} value={a}>
                        {AVATAR_AGE_LABELS[a]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Outfit */}
              <div className="space-y-1.5">
                <Label>Tenue</Label>
                <Select
                  value={formData.outfit}
                  onValueChange={(v) => setFormData((p) => ({ ...p, outfit: v as AvatarOutfit }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AVATAR_OUTFITS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {AVATAR_OUTFIT_LABELS[o]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Scope */}
              <div className="space-y-1.5">
                <Label>Portée</Label>
                <RadioGroup
                  value={formData.scope}
                  onValueChange={(v) => setFormData((p) => ({ ...p, scope: v as 'global' | 'project' }))}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="global" id="scope-global" />
                    <Label htmlFor="scope-global" className="cursor-pointer font-normal">
                      Global (réutilisable)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="project" id="scope-project" />
                    <Label htmlFor="scope-project" className="cursor-pointer font-normal">
                      Ce projet uniquement
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSaveAvatar}
                disabled={!formData.name.trim() || !formData.imageUrl || addAvatar.isPending}
              >
                Sauvegarder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Confirm narrator change dialog */}
        <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Changer de narrateur?</AlertDialogTitle>
              <AlertDialogDescription>
                Un narrateur est déjà sélectionné. Voulez-vous le remplacer par cet avatar?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelChange}>Annuler</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmChange}>Confirmer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
