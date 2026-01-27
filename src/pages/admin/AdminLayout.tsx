import { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut, Save, Rocket, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export default function AdminLayout() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { isAdmin, isLoading: roleLoading } = useAdminRole(user?.id);
  const { toast } = useToast();
  
  const {
    hasUnsavedChanges,
    isSaving,
    isPublishing,
    publishedVersion,
    draftId,
    error,
    saveDraft,
    publish,
  } = useAppConfig();

  // Redirect if not admin
  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      navigate('/auth');
    }
  }, [isAdmin, roleLoading, navigate]);

  // Show error toast
  useEffect(() => {
    if (error) {
      toast({ title: 'Erreur', description: error, variant: 'destructive' });
    }
  }, [error, toast]);

  const handleSaveDraft = async () => {
    const success = await saveDraft();
    if (success) {
      toast({ title: 'Brouillon sauvegardé', description: 'Vos modifications ont été enregistrées.' });
    }
  };

  const handlePublish = async () => {
    const success = await publish();
    if (success) {
      toast({ 
        title: 'Configuration publiée', 
        description: `Version ${publishedVersion + 1} est maintenant active.` 
      });
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <AdminSidebar hasUnsavedChanges={hasUnsavedChanges} />
      
      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="h-14 border-b border-border bg-card px-6 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <h1 className="font-semibold text-foreground">Configuration</h1>
            <Badge variant="outline" className="text-xs">
              v{publishedVersion}
            </Badge>
            {hasUnsavedChanges && (
              <Badge variant="destructive" className="text-xs">
                Modifications non sauvegardées
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Save Draft Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSaveDraft}
              disabled={!hasUnsavedChanges || isSaving}
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Sauvegarder
            </Button>
            
            {/* Publish Button */}
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={!draftId || isPublishing || hasUnsavedChanges}
              variant="default"
            >
              {isPublishing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Rocket className="w-4 h-4 mr-2" />
              )}
              Publier v{publishedVersion + 1}
            </Button>
            
            {/* User info */}
            <div className="flex items-center gap-2 pl-3 border-l border-border">
              <span className="text-sm text-muted-foreground truncate max-w-[150px]">
                {user?.email}
              </span>
              <Button variant="ghost" size="icon" onClick={handleSignOut} title="Déconnexion">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>
        
        {/* Page content */}
        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
