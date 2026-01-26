import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, Download, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useProject } from '@/hooks/useProject';
import { useToast } from '@/hooks/use-toast';
import { generateChecklist, generatePRD, generatePrompt } from '@/lib/outputGenerators';

export default function Outputs() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { project, pois, wifiZones, forbiddenZones, isLoading, validate } = useProject(projectId);
  const validation = validate();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Projet non trouvé</h2>
          <Button onClick={() => navigate('/')}>Retour au dashboard</Button>
        </div>
      </div>
    );
  }

  if (!validation.isValid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-4" />
          <h2 className="text-xl font-semibold mb-2">Validation incomplète</h2>
          <ul className="text-muted-foreground text-sm mb-4 space-y-1">
            {validation.errors.map((error, i) => (
              <li key={i}>• {error}</li>
            ))}
          </ul>
          <Button onClick={() => navigate(`/intake/${projectId}`)}>
            Compléter le formulaire
          </Button>
        </div>
      </div>
    );
  }

  const data = { project, pois, wifiZones, forbiddenZones };
  const outputs = [
    { id: 'checklist', label: 'Checklist', content: generateChecklist(data) },
    { id: 'prd', label: 'PRD', content: generatePRD(data) },
    { id: 'prompt', label: 'Prompt', content: generatePrompt(data) },
  ];

  const copyToClipboard = (content: string, label: string) => {
    navigator.clipboard.writeText(content);
    toast({
      title: 'Copié!',
      description: `${label} copié dans le presse-papier`,
    });
  };

  const downloadFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/intake/${projectId}`)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="font-semibold text-foreground">Outputs Générés</h1>
              <p className="text-xs text-muted-foreground">{project.hotel_name}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
          <Check className="w-5 h-5 text-primary" />
          <span className="text-foreground font-medium">Validation réussie - Outputs prêts</span>
        </div>

        <Tabs defaultValue="checklist">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            {outputs.map((output) => (
              <TabsTrigger key={output.id} value={output.id}>
                {output.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {outputs.map((output) => (
            <TabsContent key={output.id} value={output.id}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between py-3">
                  <CardTitle className="text-lg">{output.label}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(output.content, output.label)}
                    >
                      <Copy className="w-4 h-4 mr-1" />
                      Copier
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        downloadFile(
                          output.content,
                          `${project.hotel_name.replace(/\s+/g, '_')}_${output.id}.md`
                        )
                      }
                    >
                      <Download className="w-4 h-4 mr-1" />
                      .md
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded-lg overflow-auto max-h-[60vh] font-mono">
                    {output.content}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
}
