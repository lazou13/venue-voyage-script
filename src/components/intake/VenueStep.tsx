import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, X, FileImage, Building2 } from 'lucide-react';
import { useCallback } from 'react';
import { useProject } from '@/hooks/useProject';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

const schema = z.object({
  hotel_name: z.string().min(1, 'Nom requis').max(100),
  city: z.string().min(1, 'Ville requise').max(100),
  floors: z.coerce.number().min(1).max(100),
  visit_date: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface VenueStepProps {
  projectId: string;
}

export function VenueStep({ projectId }: VenueStepProps) {
  const { project, updateProject } = useProject(projectId);
  const { uploadFile, deleteFile, isUploading } = useFileUpload();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      hotel_name: project?.hotel_name || '',
      city: project?.city || '',
      floors: project?.floors || 1,
      visit_date: project?.visit_date || '',
    },
  });

  const onSubmit = (data: FormData) => {
    updateProject.mutate(data, {
      onSuccess: () => {
        toast({ title: 'Sauvegardé' });
      },
    });
  };

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast({
          title: 'Type invalide',
          description: 'Utilisez JPG, PNG, WebP ou PDF',
          variant: 'destructive',
        });
        return;
      }

      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: 'Fichier trop volumineux',
          description: 'Maximum 10MB',
          variant: 'destructive',
        });
        return;
      }

      try {
        const url = await uploadFile(file, `maps/${projectId}`);
        await updateProject.mutateAsync({
          map_url: url,
          map_uploaded_at: new Date().toISOString(),
        });
        toast({ title: 'Carte uploadée' });
      } catch {
        toast({
          title: 'Erreur',
          description: 'Échec de l\'upload',
          variant: 'destructive',
        });
      }
    },
    [projectId, uploadFile, updateProject, toast]
  );

  const handleRemoveMap = async () => {
    if (project?.map_url) {
      await deleteFile(project.map_url);
      await updateProject.mutateAsync({
        map_url: null,
        map_uploaded_at: null,
      });
      toast({ title: 'Carte supprimée' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Hotel Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-muted-foreground" />
            Informations Hôtel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hotel_name">Nom de l'hôtel *</Label>
                <Input
                  id="hotel_name"
                  {...register('hotel_name')}
                  placeholder="Grand Hôtel Paris"
                />
                {errors.hotel_name && (
                  <p className="text-destructive text-xs">{errors.hotel_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="city">Ville *</Label>
                <Input id="city" {...register('city')} placeholder="Paris" />
                {errors.city && (
                  <p className="text-destructive text-xs">{errors.city.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="floors">Nombre d'étages *</Label>
                <Input
                  id="floors"
                  type="number"
                  min={1}
                  max={100}
                  {...register('floors')}
                />
                {errors.floors && (
                  <p className="text-destructive text-xs">{errors.floors.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="visit_date">Date de visite</Label>
                <Input id="visit_date" type="date" {...register('visit_date')} />
              </div>
            </div>

            <Button type="submit" disabled={!isDirty || updateProject.isPending}>
              Sauvegarder
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Map Upload */}
      <Card>
        <CardHeader>
          <CardTitle>Carte / Plan de l'hôtel</CardTitle>
        </CardHeader>
        <CardContent>
          {project?.map_url ? (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden border bg-muted">
                {project.map_url.endsWith('.pdf') ? (
                  <div className="flex items-center justify-center h-48 bg-muted">
                    <FileImage className="w-16 h-16 text-muted-foreground" />
                    <span className="ml-2 text-muted-foreground">PDF uploadé</span>
                  </div>
                ) : (
                  <img
                    src={project.map_url}
                    alt="Plan de l'hôtel"
                    className="w-full h-auto max-h-96 object-contain"
                  />
                )}
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2"
                  onClick={handleRemoveMap}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Uploadé le{' '}
                {project.map_uploaded_at
                  ? new Date(project.map_uploaded_at).toLocaleString('fr-FR')
                  : 'N/A'}
              </p>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
              <Upload className="w-10 h-10 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">
                {isUploading ? 'Upload en cours...' : 'Cliquez pour uploader'}
              </span>
              <span className="text-xs text-muted-foreground mt-1">
                JPG, PNG, WebP ou PDF (max 10MB)
              </span>
              <input
                type="file"
                className="hidden"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleFileChange}
                disabled={isUploading}
              />
            </label>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
