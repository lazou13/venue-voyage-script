import { Loader2, Rocket, RotateCcw, FileJson, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export default function AdminPublish() {
  const { toast } = useToast();
  const {
    draftPayload,
    publishedPayload,
    draftVersion,
    publishedVersion,
    draftId,
    isLoading,
    isSaving,
    isPublishing,
    hasUnsavedChanges,
    saveDraft,
    publish,
    discardChanges,
  } = useAppConfig();

  const handleSaveAndPublish = async () => {
    // Save draft first if there are unsaved changes
    if (hasUnsavedChanges) {
      const saveSuccess = await saveDraft();
      if (!saveSuccess) return;
    }
    
    const publishSuccess = await publish();
    if (publishSuccess) {
      toast({ 
        title: 'Configuration publiée', 
        description: `Version ${publishedVersion + 1} est maintenant active.` 
      });
    }
  };

  const handleDiscard = () => {
    discardChanges();
    toast({ title: 'Modifications annulées', description: 'La configuration a été réinitialisée.' });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Calculate diff stats
  const draftJson = JSON.stringify(draftPayload, null, 2);
  const publishedJson = JSON.stringify(publishedPayload, null, 2);
  const hasChanges = draftJson !== publishedJson;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-semibold">Publier la configuration</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Prévisualisez les changements et publiez une nouvelle version.
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Version publiée
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-lg font-bold">
                v{publishedVersion}
              </Badge>
              <span className="text-xs text-muted-foreground">Active</span>
            </div>
          </CardContent>
        </Card>

        <Card className={hasChanges || hasUnsavedChanges ? 'border-destructive/50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              {hasChanges || hasUnsavedChanges ? (
                <AlertTriangle className="w-4 h-4 text-destructive" />
              ) : (
                <FileJson className="w-4 h-4 text-muted-foreground" />
              )}
              Brouillon
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-lg font-bold">
                v{draftVersion}
              </Badge>
              {hasUnsavedChanges && (
                <Badge variant="destructive" className="text-xs">
                  Non sauvegardé
                </Badge>
              )}
              {!hasUnsavedChanges && draftId && (
                <Badge variant="secondary" className="text-xs">
                  Prêt à publier
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* JSON Preview */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileJson className="w-4 h-4" />
            Aperçu du brouillon
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] rounded-md border bg-muted/30">
            <pre className="p-4 text-xs font-mono text-foreground whitespace-pre-wrap">
              {draftJson}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button 
              variant="outline" 
              disabled={!hasChanges && !hasUnsavedChanges}
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Annuler les modifications
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Annuler les modifications ?</AlertDialogTitle>
              <AlertDialogDescription>
                Toutes les modifications non publiées seront perdues. 
                La configuration reviendra à la version publiée (v{publishedVersion}).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Conserver</AlertDialogCancel>
              <AlertDialogAction onClick={handleDiscard}>
                Annuler les modifications
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="flex-1" />

        <Button
          size="lg"
          onClick={handleSaveAndPublish}
          disabled={(!hasChanges && !hasUnsavedChanges && !draftId) || isPublishing || isSaving}
          variant="default"
        >
          {isPublishing || isSaving ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Rocket className="w-4 h-4 mr-2" />
          )}
          {hasUnsavedChanges 
            ? `Sauvegarder & Publier v${publishedVersion + 1}`
            : `Publier v${publishedVersion + 1}`
          }
        </Button>
      </div>
    </div>
  );
}
