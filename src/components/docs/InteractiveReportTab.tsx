import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default function InteractiveReportTab() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="report-overview">
            <AccordionTrigger>Présentation du rapport interactif</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>Le rapport interactif est un <strong>fichier HTML autonome</strong> généré pour les projets de type <Badge variant="outline">Reconnaissance Parcours</Badge>. Il s'ouvre dans n'importe quel navigateur sans connexion internet requise.</p>
              <p>Il est organisé en <strong>3 sections principales</strong>, chacune avec un en-tête coloré distinctif :</p>
              <ul>
                <li><span className="text-violet-500 font-semibold">🟣 Fiche Projet</span> — Identité et paramètres</li>
                <li><span className="text-cyan-500 font-semibold">🔵 Infos Parcours</span> — Données de la trace GPS</li>
                <li><span className="text-green-500 font-semibold">🟢 Points d'intérêt</span> — Tableau POI détaillé</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="report-project-sheet">
            <AccordionTrigger>Fiche Projet — Identité et paramètres</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>La fiche projet affiche 4 blocs éditables :</p>
              <ul>
                <li><strong>Identité :</strong> Nom du lieu, ville, thème</li>
                <li><strong>Infos publiques :</strong> Durée, difficulté, public cible</li>
                <li><strong>Paramètres :</strong> Type de quête, mode de jeu, langues</li>
                <li><strong>Options :</strong> Storytelling, props autorisés, staff disponible</li>
              </ul>
              <p>Tous les champs sont <strong>éditables directement</strong> dans le rapport en cliquant dessus.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="report-track-info">
            <AccordionTrigger>Infos Parcours — Trace et temps</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>Section avec dégradé cyan affichant les métadonnées de la trace GPS :</p>
              <ul>
                <li><strong>Distance :</strong> Calculée automatiquement depuis la trace</li>
                <li><strong>Mode transport :</strong> À pied, vélo, bus, voiture, bateau, mixte</li>
                <li><strong>Vitesse :</strong> Vitesse moyenne estimée selon le mode</li>
                <li><strong>Temps trajet / Temps arrêts :</strong> Éditables avec override manuel et bouton de reset</li>
                <li><strong>Temps total :</strong> Somme auto-calculée, mise à jour en temps réel</li>
              </ul>
              <p>Le bouton <strong>↻ Reset</strong> permet de revenir à la valeur calculée automatiquement après un override manuel.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="report-poi-table">
            <AccordionTrigger>Tableau POI — 12 colonnes éditables</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>Le tableau affiche tous les POIs avec <strong>12 colonnes</strong>, toutes éditables :</p>
              <ol>
                <li><strong>#</strong> — Numéro d'ordre</li>
                <li><strong>Nom</strong> — Nom du point d'intérêt</li>
                <li><strong>Zone</strong> — Localisation</li>
                <li><strong>Type</strong> — Type d'étape (dropdown : QR Code, Photo, Objet trouvé, Final…)</li>
                <li><strong>Interaction</strong> — Type d'interaction</li>
                <li><strong>Risque</strong> — Niveau de risque</li>
                <li><strong>Temps (min)</strong> — Durée estimée</li>
                <li><strong>Latitude</strong> — Coordonnée GPS</li>
                <li><strong>Longitude</strong> — Coordonnée GPS</li>
                <li><strong>Notes</strong> — Commentaires libres</li>
                <li><strong>Photo</strong> — Indicateur de photo associée</li>
                <li><strong>Audio</strong> — Indicateur d'enregistrement vocal</li>
              </ol>
              <p>Boutons d'action : <strong>+ Ajouter une ligne</strong> et <strong>🗑 Supprimer</strong> par ligne.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="report-map">
            <AccordionTrigger>Carte interactive</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>La carte Leaflet affiche la trace GPS et les marqueurs numérotés :</p>
              <ul>
                <li><span className="text-green-500 font-semibold">● Vert</span> — Point de départ (marqueur #1)</li>
                <li><span className="text-pink-500 font-semibold">● Rose</span> — Point d'arrivée (dernier marqueur)</li>
                <li><span className="text-violet-500 font-semibold">● Violet</span> — Points intermédiaires</li>
              </ul>
              <p>Chaque marqueur affiche son numéro. La trace est dessinée comme un polyline bleu.</p>
              <p className="text-muted-foreground text-xs">Si la carte ne peut pas se charger (hors ligne ou restrictions réseau), un message « Map Unavailable » s'affiche avec les coordonnées textuelles.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="report-persistence">
            <AccordionTrigger>Persistance des modifications</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>Toutes les modifications faites dans le rapport sont <strong>sauvegardées automatiquement</strong> dans le <code>localStorage</code> du navigateur :</p>
              <ul>
                <li>Clé de stockage : <code>interactive_report:&lt;traceId&gt;</code></li>
                <li>Restauration automatique à la réouverture du fichier</li>
                <li>Les données persistent même après fermeture du navigateur</li>
              </ul>
              <p className="text-muted-foreground text-xs">Attention : les données sont liées au navigateur. Changer de navigateur ou vider le cache effacera les modifications.</p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="report-exports">
            <AccordionTrigger>Exports depuis le rapport</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>Le rapport intègre ses propres boutons d'export :</p>
              <ul>
                <li><strong>PDF :</strong> Version imprimable du rapport avec état actuel</li>
                <li><strong>JSON :</strong> Données structurées exportables (inclut toutes les modifications)</li>
                <li><strong>Word :</strong> Document .docx formaté pour partage professionnel</li>
                <li><strong>HTML :</strong> Copie du rapport avec l'état actuel intégré dans le fichier</li>
              </ul>
              <p>Tous les exports reflètent l'<strong>état actuel</strong> du rapport, y compris les modifications manuelles.</p>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
