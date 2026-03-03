import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';

export default function AdminGuideTab() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="enums">
            <AccordionTrigger>Enums — Gestion des listes</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>L'onglet <strong>Enums</strong> permet de gérer toutes les listes de valeurs utilisées dans l'application :</p>
              <ul>
                <li>Types d'étapes : story, mcq, enigme, code, hangman, memory, photo, terrain, defi, <strong>transition</strong>, <strong>qr_code</strong>, <strong>info_qr</strong>, <strong>countdown</strong></li>
                <li>Modes de validation : qr_code, photo, code, manual, free, <strong>validation_chain</strong></li>
                <li>Modes de transport : walking, cycling, bus, car, boat, mixed</li>
                <li>Audiences cibles, langues, modes de jeu, niveaux de difficulté</li>
              </ul>
              <p>Chaque enum peut être modifié avec un label FR et EN. Les modifications sont sauvegardées dans le brouillon.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="presets">
            <AccordionTrigger>Préréglages — Templates de quêtes</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>Les <strong>préréglages</strong> sont des templates de configuration pré-remplis. Quand un utilisateur crée un projet, il peut choisir un préréglage qui pré-remplit automatiquement la configuration.</p>
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
                <li>Exemple : « Si storytelling est activé, le narrateur est obligatoire »</li>
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
                <li><strong>Modifier :</strong> Les changements sont appliqués localement. Un badge « Modifications non sauvegardées » apparaît.</li>
                <li><strong>Sauvegarder :</strong> Le bouton « Sauvegarder » persiste le brouillon en base de données.</li>
                <li><strong>Publier :</strong> Le bouton « Publier » crée une nouvelle version publiée. Le formulaire Intake utilise toujours la dernière version publiée.</li>
              </ol>
              <p>Ce système permet de préparer des modifications sans impacter les utilisateurs avant publication.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="escrow">
            <AccordionTrigger>Dossier technique Escrow</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>Le bouton « Télécharger le dossier technique » génère un fichier ZIP contenant :</p>
              <ul>
                <li><strong>Architecture :</strong> Stack technique, structure des dossiers, patterns utilisés</li>
                <li><strong>Types :</strong> Toutes les interfaces TypeScript (QuestConfig, StepConfig, POI, etc.)</li>
                <li><strong>Schéma BDD :</strong> Tables, colonnes, relations, RLS policies</li>
                <li><strong>Hooks :</strong> Documentation de tous les hooks custom (useProject, usePOIs, useAuth, etc.)</li>
              </ul>
              <p className="text-muted-foreground text-xs">Aucun code source n'est inclus — uniquement la documentation technique pour des besoins d'évaluation ou de transfert.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
