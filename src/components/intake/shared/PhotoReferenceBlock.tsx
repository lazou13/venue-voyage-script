import { useState } from 'react';
import { Camera, Trash2, ImageIcon, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useToast } from '@/hooks/use-toast';

interface PhotoReferenceBlockProps {
  photoReferenceRequired: boolean;
  referenceImageUrl: string | null;
  referenceImageCaption: string | null;
  onUpdate: (updates: {
    photo_reference_required?: boolean;
    reference_image_url?: string | null;
    reference_image_caption?: string | null;
  }) => void;
  projectId: string;
  stepId: string;
}

export function PhotoReferenceBlock({
  photoReferenceRequired,
  referenceImageUrl,
  referenceImageCaption,
  onUpdate,
  projectId,
  stepId,
}: PhotoReferenceBlockProps) {
  const { uploadFile, deleteFile, isUploading } = useFileUpload();
  const { toast } = useToast();
  const [localCaption, setLocalCaption] = useState(referenceImageCaption || '');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: 'Erreur', description: 'Veuillez sélectionner une image', variant: 'destructive' });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Erreur', description: 'Image trop volumineuse (max 10MB)', variant: 'destructive' });
      return;
    }

    try {
      const url = await uploadFile(file, `projects/${projectId}/steps/${stepId}/reference`);
      onUpdate({ reference_image_url: url });
      toast({ title: 'Photo uploadée' });
    } catch (err) {
      toast({ title: 'Erreur upload', description: String(err), variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (referenceImageUrl) {
      try {
        await deleteFile(referenceImageUrl);
      } catch {
        // Ignore delete errors (file may not exist)
      }
    }
    onUpdate({ reference_image_url: null, reference_image_caption: null });
    setLocalCaption('');
    toast({ title: 'Photo supprimée' });
  };

  const handleToggle = (checked: boolean) => {
    if (!checked) {
      // Reset all photo reference fields when disabling
      onUpdate({
        photo_reference_required: false,
        reference_image_url: null,
        reference_image_caption: null,
      });
      setLocalCaption('');
    } else {
      onUpdate({ photo_reference_required: true });
    }
  };

  const handleCaptionBlur = () => {
    if (localCaption !== referenceImageCaption) {
      onUpdate({ reference_image_caption: localCaption || null });
    }
  };

  return (
    <div className="p-3 border rounded-lg bg-muted/30 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-muted-foreground" />
          <Label className="text-sm font-medium">Photo de référence</Label>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Requise</span>
          <Switch
            checked={photoReferenceRequired}
            onCheckedChange={handleToggle}
          />
        </div>
      </div>

      {photoReferenceRequired && (
        <div className="space-y-3 pt-2 border-t">
          {/* Image preview or upload button */}
          {referenceImageUrl ? (
            <div className="space-y-2">
              <div className="relative rounded-lg overflow-hidden bg-muted aspect-video max-w-[200px]">
                <img
                  src={referenceImageUrl}
                  alt="Photo de référence"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex gap-2">
                <label className="cursor-pointer">
                  <Button variant="outline" size="sm" asChild disabled={isUploading}>
                    <span>
                      <Upload className="w-3 h-3 mr-1" />
                      Remplacer
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isUploading}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Supprimer
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {isUploading ? (
                <div className="flex items-center justify-center p-4 max-w-[200px]">
                  <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                <div className="flex gap-2">
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        <Camera className="w-3 h-3 mr-1" />
                        📷 Photo
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                  <label className="cursor-pointer">
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        <Upload className="w-3 h-3 mr-1" />
                        📁 Fichier
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Caption input */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Légende (optionnel)</Label>
            <Input
              value={localCaption}
              onChange={(e) => setLocalCaption(e.target.value)}
              onBlur={handleCaptionBlur}
              placeholder="Ex: statue patio, côté fontaine"
              className="text-sm h-8"
            />
          </div>
        </div>
      )}
    </div>
  );
}
