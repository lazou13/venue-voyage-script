import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';

export default function FaqTab() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="faq-create">
            <AccordionTrigger>Comment créer un nouveau projet ?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Depuis le Dashboard, cliquez sur « Nouveau projet ». Renseignez le nom du lieu et la ville, puis validez. Vous serez redirigé vers le formulaire Intake.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="faq-pois">
            <AccordionTrigger>Comment ajouter des étapes (POIs) à mon projet ?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Dans l'onglet « Terrain » du formulaire Intake, cliquez sur « Ajouter un POI ». Renseignez le nom, la zone, le type d'interaction et configurez les options. Puis dans l'onglet « Étapes », configurez en détail chaque POI (type d'étape, validation, scoring, indices).
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="faq-gps">
            <AccordionTrigger>Le GPS ne fonctionne pas, que faire ?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Assurez-vous d'avoir autorisé l'accès à la géolocalisation dans votre navigateur. Le GPS peut mettre jusqu'à 30 secondes pour s'accrocher. En cas de timeout, le système réessaie automatiquement. Si le problème persiste, vérifiez que vous êtes en extérieur ou près d'une fenêtre.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="faq-save-publish">
            <AccordionTrigger>Quelle est la différence entre sauvegarder et publier ?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              <strong>Sauvegarder</strong> enregistre vos modifications comme brouillon — elles ne sont pas encore visibles pour les utilisateurs du formulaire Intake. <strong>Publier</strong> crée une nouvelle version active qui sera immédiatement utilisée par tous.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="faq-exports">
            <AccordionTrigger>Comment exporter les données d'un projet ?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Dans l'onglet « Exports » du formulaire Intake, vous pouvez générer 4 types de documents : Checklist terrain, PRD, Prompt IA et Rapport interactif HTML. Chaque export est généré côté client et téléchargé directement.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="faq-markers">
            <AccordionTrigger>Puis-je convertir les marqueurs GPS en étapes de jeu ?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Oui ! Après avoir enregistré une trace GPS en mode reconnaissance, les marqueurs posés peuvent être convertis en POIs. Ils apparaîtront dans l'onglet « Étapes » avec un flag indiquant leur origine.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="faq-cross-tab">
            <AccordionTrigger>Comment fonctionne la synchronisation entre onglets ?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Le bandeau CrossTabSummary en haut du formulaire affiche un résumé en temps réel des données saisies dans les différents onglets. Il détecte automatiquement les incohérences (ex : POI sans zone définie) et recalcule la durée totale à partir des temps individuels. Cliquez sur un badge pour naviguer vers l'onglet source.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="faq-transport">
            <AccordionTrigger>Comment utiliser le mode transport ?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Dans l'onglet Core, sélectionnez le mode de transport adapté à votre quête : à pied, vélo, bus, voiture, bateau ou mixte. Ce paramètre influence le calcul de durée et les indications de déplacement entre les étapes. Le rapport interactif affiche aussi la vitesse estimée selon le mode choisi.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="faq-step-types">
            <AccordionTrigger>Quels sont les nouveaux types d'étapes disponibles ?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              4 nouveaux types ont été ajoutés : <strong>Transition</strong> (étape de liaison sans gameplay), <strong>QR Code</strong> (scan pour débloquer), <strong>Info QR</strong> (informations après scan), et <strong>Compte à rebours</strong> (action requise avant expiration d'un timer). Un nouveau mode de validation <strong>Chaîne de validation</strong> permet d'enchaîner plusieurs validations sur une même étape.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="faq-report">
            <AccordionTrigger>Comment fonctionne le rapport interactif ?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Le rapport interactif est un fichier HTML autonome généré pour les projets « Reconnaissance Parcours ». Il contient 3 sections (Fiche Projet, Infos Parcours, Tableau POI) avec des champs éditables directement dans le navigateur. Les modifications sont sauvegardées automatiquement dans le localStorage et peuvent être exportées en PDF, JSON, Word ou HTML.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="faq-report-export">
            <AccordionTrigger>Comment exporter le rapport HTML avec mes modifications ?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Depuis le rapport interactif ouvert dans votre navigateur, utilisez le bouton « Exporter HTML » en haut du rapport. Le fichier généré contiendra toutes vos modifications intégrées. Vous pouvez aussi exporter en PDF, JSON ou Word — tous les formats reflètent l'état actuel de vos données.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="faq-voice">
            <AccordionTrigger>Comment fonctionne l'enregistrement vocal des marqueurs ?</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Lors de l'enregistrement d'une trace GPS, vous pouvez ajouter un enregistrement vocal à chaque marqueur. Cliquez sur le bouton microphone lors de la pose du marqueur, parlez, puis arrêtez l'enregistrement. Le fichier audio est uploadé et associé au marqueur. Il apparaîtra dans le rapport interactif et dans les exports.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
