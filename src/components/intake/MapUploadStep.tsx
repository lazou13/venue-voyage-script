import { useCallback } from 'react';
import { Upload, X, FileImage } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { useFileUpload } from '@/hooks/useFileUpload';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface MapUploadStepProps {
  projectId: string;
}

export function MapUploadStep({ projectId }: MapUploadStepProps) {
  const { project, updateProject } = useProject(projectId);
  const { uploadFile, deleteFile, isUploading } = useFileUpload();
  const { toast } = useToast();

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Validate file type
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        toast({
          title: 'Type invalide',
          description: 'Utilisez JPG, PNG, WebP ou PDF',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (max 10MB)
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
        toast({ title: 'Carte uploadée', description: 'Plan de l\'hôtel sauvegardé' });
      } catch (error) {
        toast({
          title: 'Erreur',
          description: 'Échec de l\'upload',
          variant: 'destructive',
        });
      }
    },
    [projectId, uploadFile, updateProject, toast]
  );

  const handleRemove = async () => {
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
                onClick={handleRemove}
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
  );
}
