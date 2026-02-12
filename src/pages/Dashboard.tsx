import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, MapPin, Calendar, Trash2, Sparkles, FolderOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import type { Project } from '@/types/intake';
import { cn } from '@/lib/utils';

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Modern Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border/50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Treasure Hunt</h1>
                <p className="text-muted-foreground text-xs">Configurateur de quêtes</p>
              </div>
            </div>
            <Button 
              onClick={() => setDialogOpen(true)} 
              className="rounded-full gap-2 shadow-soft hover:shadow-medium transition-shadow"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Nouveau Projet</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {projects?.length === 0 ? (
          <div className="empty-state animate-fade-in">
            <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-muted/50 flex items-center justify-center">
              <FolderOpen className="w-10 h-10 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Aucun projet</h2>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Créez votre premier projet de chasse au trésor pour commencer l'aventure !
            </p>
            <Button 
              onClick={() => setDialogOpen(true)} 
              size="lg"
              className="rounded-full gap-2 shadow-soft hover:shadow-medium"
            >
              <Plus className="w-5 h-5" />
              Créer un projet
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects?.map((project, index) => (
              <Card
                key={project.id}
                className={cn(
                  "group cursor-pointer card-hover animate-fade-in",
                  "hover:shadow-large"
                )}
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => navigate(`/intake/${project.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg font-semibold truncate group-hover:text-primary transition-colors">
                        {project.hotel_name}
                      </CardTitle>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity -mr-2 -mt-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProject.mutate(project.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-4 h-4" />
                      <span>{project.city}</span>
                    </div>
                    {project.visit_date && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(project.visit_date).toLocaleDateString('fr-FR')}</span>
                      </div>
                    )}
                  </div>
                  <Badge 
                    variant={project.is_complete ? "default" : "secondary"}
                    className={cn(
                      "rounded-full text-xs",
                      project.is_complete 
                        ? "bg-success/10 text-success hover:bg-success/20" 
                        : "bg-warning/10 text-warning hover:bg-warning/20"
                    )}
                  >
                    {project.is_complete ? '✓ Complet' : '◦ En cours'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <CreateProjectDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
