import { useState } from 'react';
import { Download, Loader2, BookOpen, Settings2, HelpCircle, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { generateEscrowZip } from '@/lib/escrowDocGenerator';
import UserGuideTab from '@/components/docs/UserGuideTab';
import AdminGuideTab from '@/components/docs/AdminGuideTab';
import InteractiveReportTab from '@/components/docs/InteractiveReportTab';
import FaqTab from '@/components/docs/FaqTab';

export default function AdminDocs() {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();

  const handleDownloadEscrow = async () => {
    setIsGenerating(true);
    try {
      await generateEscrowZip();
      toast({ title: 'Téléchargement lancé', description: 'Le dossier technique escrow a été généré.' });
    } catch (e) {
      toast({ title: 'Erreur', description: 'Impossible de générer le fichier.', variant: 'destructive' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Documentation</h2>
        <p className="text-muted-foreground mt-1">Guide complet d'utilisation, administration et documentation technique</p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            Dossier technique (Escrow)
          </CardTitle>
          <CardDescription>
            Téléchargez un ZIP contenant la documentation technique complète de l'application
            (architecture, types, schéma BDD, hooks). Aucun code source n'est inclus.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleDownloadEscrow} disabled={isGenerating}>
            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Télécharger le dossier technique
          </Button>
        </CardContent>
      </Card>

      <Separator />

      <Tabs defaultValue="guide" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="guide" className="gap-1.5">
            <BookOpen className="w-4 h-4" /> Guide utilisateur
          </TabsTrigger>
          <TabsTrigger value="admin" className="gap-1.5">
            <Settings2 className="w-4 h-4" /> Guide admin
          </TabsTrigger>
          <TabsTrigger value="report" className="gap-1.5">
            <FileText className="w-4 h-4" /> Rapport interactif
          </TabsTrigger>
          <TabsTrigger value="faq" className="gap-1.5">
            <HelpCircle className="w-4 h-4" /> FAQ
          </TabsTrigger>
        </TabsList>

        <TabsContent value="guide"><UserGuideTab /></TabsContent>
        <TabsContent value="admin"><AdminGuideTab /></TabsContent>
        <TabsContent value="report"><InteractiveReportTab /></TabsContent>
        <TabsContent value="faq"><FaqTab /></TabsContent>
      </Tabs>
    </div>
  );
}
