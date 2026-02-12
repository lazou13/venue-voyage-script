import { useState } from 'react';
import { Download, Loader2, BookOpen, Settings2, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { generateEscrowZip } from '@/lib/escrowDocGenerator';

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
        <p className="text-muted-foreground mt-1">Guide d'utilisation et documentation technique</p>
      </div>

      {/* Escrow download card */}
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

      {/* Tabs for user guide / admin guide / FAQ */}
      <Tabs defaultValue="guide" className="w-full">
        <TabsList>
          <TabsTrigger value="guide" className="gap-1.5">
            <BookOpen className="w-4 h-4" /> Guide utilisateur
          </TabsTrigger>
          <TabsTrigger value="admin" className="gap-1.5">
            <Settings2 className="w-4 h-4" /> Guide admin
          </TabsTrigger>
          <TabsTrigger value="faq" className="gap-1.5">
            <HelpCircle className="w-4 h-4" /> FAQ
          </TabsTrigger>
        </TabsList>

        {/* ===== USER GUIDE ===== */}
        <TabsContent value="guide">
          <Card>
            <CardContent className="pt-6">
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="dashboard">
                  <AccordionTrigger>Dashboard — Gestion des projets</AccordionTrigger>
                  <AccordionContent className="prose prose-sm max-w-none text-foreground">
                    <p>Le <strong>Dashboard</strong> est la page d'accueil. Il affiche tous vos projets de quête.</p>
                    <ul>
                      <li><strong>Créer un projet :</strong> Cliquez sur "Nouveau projet", renseignez le nom du lieu et la ville.</li>
                      <li><strong>Ouvrir un projet :</strong> Cliquez sur la carte du projet pour accéder au formulaire Intake.</li>
                      <li><strong>Statut :</strong> Un badge indique si le projet est complet ou en cours.</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="intake">
                  <AccordionTrigger>Formulaire Intake — Les 6 onglets</AccordionTrigger>
                  <AccordionContent className="prose prose-sm max-w-none text-foreground">
                    <p>Le formulaire Intake est organisé en <strong>6 onglets</strong> :</p>
                    <ol>
                      <li><strong>Core :</strong> Informations de base — type de projet, mode de jeu, audience cible, langues, durée, difficulté, storytelling.</li>
                      <li><strong>Lieu :</strong> Détails spécifiques au type de lieu — espaces (établissement), points de départ/arrivée (site touristique), ou segments de route (reconnaissance).</li>
                      <li><strong>Terrain :</strong> Zones Wi-Fi, zones interdites, plan du lieu, date de visite.</li>
                      <li><strong>Étapes :</strong> Création et configuration des Points d'Intérêt (POIs) — type d'étape, mode de validation, scoring, indices, branchement.</li>
                      <li><strong>Règles :</strong> Checklist de décisions client (QR autorisés, défis photo, staff impliqué, etc.).</li>
                      <li><strong>Exports :</strong> Génération de documents — Checklist terrain, PRD, Prompt IA, Rapport interactif HTML.</li>
                    </ol>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="project-types">
                  <AccordionTrigger>Types de projets</AccordionTrigger>
                  <AccordionContent className="prose prose-sm max-w-none text-foreground">
                    <p>Trois types de projets sont disponibles :</p>
                    <ul>
                      <li><strong>Établissement :</strong> Hôtel, musée, parc d'attractions. L'onglet Lieu affiche les espaces, zones privées, opérations staff et notes Wi-Fi.</li>
                      <li><strong>Site Touristique :</strong> Ville, quartier, site naturel. L'onglet Lieu affiche les points de départ/arrivée, zones à éviter, créneaux horaires et landmarks.</li>
                      <li><strong>Reconnaissance Parcours :</strong> Mode terrain avec enregistrement GPS. Active le mode repérage avec carte interactive.</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="play-modes">
                  <AccordionTrigger>Modes de jeu</AccordionTrigger>
                  <AccordionContent className="prose prose-sm max-w-none text-foreground">
                    <ul>
                      <li><strong>Solo :</strong> Un joueur parcourt la quête seul.</li>
                      <li><strong>Équipes :</strong> Plusieurs équipes s'affrontent. Configuration du nombre d'équipes, joueurs par équipe, mode de compétition (course, score, temps limité).</li>
                      <li><strong>1 vs 1 :</strong> Deux joueurs en duel.</li>
                      <li><strong>Multi-joueurs (classement) :</strong> Plusieurs joueurs en solo avec un classement partagé.</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="gps">
                  <AccordionTrigger>Mode repérage GPS</AccordionTrigger>
                  <AccordionContent className="prose prose-sm max-w-none text-foreground">
                    <p>Disponible pour les projets de type <Badge variant="outline">Reconnaissance Parcours</Badge>.</p>
                    <ul>
                      <li><strong>Démarrer :</strong> Cliquez sur "Démarrer l'enregistrement" pour activer le suivi GPS.</li>
                      <li><strong>Marqueurs :</strong> Posez des marqueurs aux points d'intérêt avec une note optionnelle.</li>
                      <li><strong>Arrêter :</strong> L'enregistrement sauvegarde la trace GeoJSON, la distance et la durée.</li>
                      <li><strong>Conversion :</strong> Les marqueurs peuvent être convertis en POIs pour le jeu.</li>
                    </ul>
                    <p className="text-muted-foreground text-xs">Note : Le GPS peut mettre quelques secondes à s'accrocher. Le système réessaie automatiquement en cas de timeout.</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="exports">
                  <AccordionTrigger>Exports et documents générés</AccordionTrigger>
                  <AccordionContent className="prose prose-sm max-w-none text-foreground">
                    <ul>
                      <li><strong>Checklist terrain :</strong> Document récapitulatif des zones, Wi-Fi, contraintes pour la visite sur site.</li>
                      <li><strong>PRD (Product Requirements Document) :</strong> Spécifications complètes du projet pour le développement.</li>
                      <li><strong>Prompt IA :</strong> Prompt pré-formaté pour générer du contenu avec une IA.</li>
                      <li><strong>Rapport interactif :</strong> Fichier HTML autonome avec toutes les données du projet, visualisable dans un navigateur.</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== ADMIN GUIDE ===== */}
        <TabsContent value="admin">
          <Card>
            <CardContent className="pt-6">
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="enums">
                  <AccordionTrigger>Enums — Gestion des listes</AccordionTrigger>
                  <AccordionContent className="prose prose-sm max-w-none text-foreground">
                    <p>L'onglet <strong>Enums</strong> permet de gérer toutes les listes de valeurs utilisées dans l'application :</p>
                    <ul>
                      <li>Types d'étapes (story, mcq, enigme, etc.)</li>
                      <li>Modes de validation (QR, photo, code, etc.)</li>
                      <li>Audiences cibles, langues, modes de jeu</li>
                    </ul>
                    <p>Chaque enum peut être modifié avec un label FR et EN. Les modifications sont sauvegardées dans le brouillon.</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="presets">
                  <AccordionTrigger>Préréglages — Templates de quêtes</AccordionTrigger>
                  <AccordionContent className="prose prose-sm max-w-none text-foreground">
                    <p>Les <strong>préréglages</strong> sont des templates de configuration pré-remplis. Quand un utilisateur crée un projet, il peut choisir un préréglage qui pré-remplit automatiquement la configuration de la quête.</p>
                    <ul>
                      <li>Chaque préréglage a un nom, une description et un payload JSON</li>
                      <li>Le payload contient les valeurs par défaut de QuestConfig</li>
                      <li>Un éditeur JSON intégré permet de modifier le payload</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="fields">
                  <AccordionTrigger>Champs — Visibilité et obligation</AccordionTrigger>
                  <AccordionContent className="prose prose-sm max-w-none text-foreground">
                    <p>L'onglet <strong>Champs</strong> contrôle quels champs sont visibles et/ou obligatoires dans le formulaire Intake :</p>
                    <ul>
                      <li><strong>Visible :</strong> Le champ apparaît dans le formulaire</li>
                      <li><strong>Requis :</strong> Le champ doit être rempli pour valider</li>
                    </ul>
                    <p>Cela permet d'adapter le formulaire selon les besoins du client sans modifier le code.</p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="rules">
                  <AccordionTrigger>Règles — Validation conditionnelle</AccordionTrigger>
                  <AccordionContent className="prose prose-sm max-w-none text-foreground">
                    <p>Le moteur de <strong>règles</strong> permet de définir des validations conditionnelles en JSON :</p>
                    <ul>
                      <li>Exemple : "Si storytelling est activé, le narrateur est obligatoire"</li>
                      <li>Chaque règle a une condition, un message d'erreur et un niveau de sévérité (warning/error)</li>
                      <li>Les règles sont évaluées côté client lors de la validation du formulaire</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="labels">
                  <AccordionTrigger>Labels — Traductions</AccordionTrigger>
                  <AccordionContent className="prose prose-sm max-w-none text-foreground">
                    <p>L'onglet <strong>Labels</strong> permet de gérer les traductions FR/EN de tous les textes de l'interface utilisateur.</p>
                    <ul>
                      <li>Chaque label a une clé unique, un texte FR et un texte EN</li>
                      <li>Les labels sont utilisés dans le formulaire Intake et les exports</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="workflow">
                  <AccordionTrigger>Workflow brouillon / publication</AccordionTrigger>
                  <AccordionContent className="prose prose-sm max-w-none text-foreground">
                    <p>Toutes les modifications admin suivent un workflow en 3 étapes :</p>
                    <ol>
                      <li><strong>Modifier :</strong> Les changements sont appliqués localement (state React). Un badge "Modifications non sauvegardées" apparaît.</li>
                      <li><strong>Sauvegarder :</strong> Le bouton "Sauvegarder" persiste le brouillon en base de données.</li>
                      <li><strong>Publier :</strong> Le bouton "Publier" crée une nouvelle version publiée. Le formulaire Intake utilise toujours la dernière version publiée.</li>
                    </ol>
                    <p>Ce système permet de préparer des modifications sans impacter les utilisateurs avant publication.</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== FAQ ===== */}
        <TabsContent value="faq">
          <Card>
            <CardContent className="pt-6">
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="faq-1">
                  <AccordionTrigger>Comment créer un nouveau projet ?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Depuis le Dashboard, cliquez sur "Nouveau projet". Renseignez le nom du lieu et la ville, puis validez. Vous serez redirigé vers le formulaire Intake.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-2">
                  <AccordionTrigger>Comment ajouter des étapes (POIs) à mon projet ?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Dans l'onglet "Étapes" du formulaire Intake, cliquez sur "Ajouter une étape". Renseignez le nom, la zone, le type d'interaction et configurez les options de l'étape (type, validation, scoring, indices).
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-3">
                  <AccordionTrigger>Le GPS ne fonctionne pas, que faire ?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Assurez-vous d'avoir autorisé l'accès à la géolocalisation dans votre navigateur. Le GPS peut mettre jusqu'à 30 secondes pour s'accrocher. En cas de timeout, le système réessaie automatiquement. Si le problème persiste, vérifiez que vous êtes en extérieur ou près d'une fenêtre.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-4">
                  <AccordionTrigger>Quelle est la différence entre sauvegarder et publier ?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    <strong>Sauvegarder</strong> enregistre vos modifications comme brouillon — elles ne sont pas encore visibles pour les utilisateurs du formulaire Intake. <strong>Publier</strong> crée une nouvelle version active qui sera immédiatement utilisée par tous.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-5">
                  <AccordionTrigger>Comment exporter les données d'un projet ?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Dans l'onglet "Exports" du formulaire Intake, vous pouvez générer 4 types de documents : Checklist terrain, PRD, Prompt IA et Rapport interactif HTML. Chaque export est généré côté client et téléchargé directement.
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="faq-6">
                  <AccordionTrigger>Puis-je convertir les marqueurs GPS en étapes de jeu ?</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    Oui ! Après avoir enregistré une trace GPS en mode reconnaissance, les marqueurs posés peuvent être convertis en POIs. Ils apparaîtront dans l'onglet "Étapes" avec un flag indiquant leur origine.
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
