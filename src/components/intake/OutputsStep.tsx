import { Copy, Download, Check, AlertCircle, AlertTriangle } from 'lucide-react';
import { useProject } from '@/hooks/useProject';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { generateChecklist, generatePRD, generatePrompt } from '@/lib/outputGenerators';

interface OutputsStepProps {
  projectId: string;
}

export function OutputsStep({ projectId }: OutputsStepProps) {
  const { project, pois, wifiZones, forbiddenZones, validate } = useProject(projectId);
  const { toast } = useToast();
  const validation = validate();

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

  if (!project) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>Projet non chargé</p>
        </CardContent>
      </Card>
    );
  }

  // Validation panel
  if (!validation.isValid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" />
            Validation incomplète
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Corrigez les erreurs suivantes avant de générer les outputs:
          </p>
          <ul className="space-y-2">
            {validation.errors.map((error, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                {error}
              </li>
            ))}
          </ul>
          {validation.warnings.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground mt-4">Avertissements (non bloquants):</p>
              <ul className="space-y-2">
                {validation.warnings.map((warning, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    {warning}
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    );
  }

  const data = { project, pois, wifiZones, forbiddenZones };
  const outputs = [
    { id: 'checklist', label: 'Checklist', content: generateChecklist(data) },
    { id: 'prd', label: 'PRD', content: generatePRD(data) },
    { id: 'prompt', label: 'Prompt', content: generatePrompt(data) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
        <Check className="w-5 h-5 text-primary" />
        <span className="text-foreground font-medium">Validation réussie - Outputs prêts</span>
        <Badge variant="secondary" className="ml-auto">
          {pois.length} étapes
        </Badge>
      </div>

      {validation.warnings.length > 0 && (
        <div className="p-3 bg-muted/50 rounded-lg border border-muted">
          <p className="text-sm font-medium text-muted-foreground mb-2">Avertissements:</p>
          <ul className="space-y-1">
            {validation.warnings.slice(0, 3).map((warning, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                {warning}
              </li>
            ))}
            {validation.warnings.length > 3 && (
              <li className="text-xs text-muted-foreground">
                + {validation.warnings.length - 3} autres...
              </li>
            )}
          </ul>
        </div>
      )}

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
  );
}
