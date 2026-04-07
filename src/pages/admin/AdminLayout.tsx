import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Save, Rocket, Loader2, Home, LogOut } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { AppConfigProvider, useAppConfigContext } from '@/contexts/AppConfigContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

function AdminLayoutInner() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signOut } = useAuthContext();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };
  
  const {
    hasUnsavedChanges, isSaving, isPublishing, publishedVersion, draftId, error, saveDraft, publish,
  } = useAppConfigContext();

  useEffect(() => {
    if (error) toast({ title: 'Erreur', description: error, variant: 'destructive' });
  }, [error, toast]);

  const handleSaveDraft = async () => {
    const success = await saveDraft();
    if (success) toast({ title: 'Brouillon sauvegardé', description: 'Vos modifications ont été enregistrées.' });
  };

  const handlePublish = async () => {
    const success = await publish();
    if (success) toast({ title: 'Configuration publiée', description: `Version ${publishedVersion + 1} est maintenant active.` });
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <header className="h-14 border-b border-border bg-card px-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-foreground">Configuration</h1>
            <Badge variant="outline" className="text-xs">v{publishedVersion}</Badge>
            {hasUnsavedChanges && <Badge variant="destructive" className="text-xs">Modifications non sauvegardées</Badge>}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleSaveDraft} disabled={!hasUnsavedChanges || isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Sauvegarder
            </Button>
            <Button size="sm" onClick={handlePublish} disabled={!draftId || isPublishing || hasUnsavedChanges}>
              {isPublishing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Rocket className="w-4 h-4 mr-2" />}Publier v{publishedVersion + 1}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => navigate('/')} title="Retour au dashboard"><Home className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Déconnexion"><LogOut className="w-4 h-4" /></Button>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-auto"><Outlet /></main>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  return (
    <AppConfigProvider>
      <AdminLayoutInner />
    </AppConfigProvider>
  );
}
