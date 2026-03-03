import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function UserGuideTab() {
  return (
    <Card>
      <CardContent className="pt-6">
        <Accordion type="multiple" className="w-full">
          {/* 1. Dashboard */}
          <AccordionItem value="dashboard">
            <AccordionTrigger>Dashboard — Gestion des projets</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>Le <strong>Dashboard</strong> est la page d'accueil après connexion. Il affiche tous vos projets de quête sous forme de cartes.</p>
              <ul>
                <li><strong>Créer un projet :</strong> Cliquez sur « Nouveau projet », renseignez le <em>nom du lieu</em> et la <em>ville</em>, puis validez.</li>
                <li><strong>Ouvrir un projet :</strong> Cliquez sur la carte du projet pour accéder au formulaire Intake.</li>
                <li><strong>Statut :</strong> Un badge indique si le projet est <Badge variant="outline">Complet</Badge> ou <Badge variant="secondary">En cours</Badge>.</li>
                <li><strong>Supprimer :</strong> Utilisez le bouton de suppression sur la carte (action irréversible).</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* 2. Formulaire Intake — Vue d'ensemble */}
          <AccordionItem value="intake-overview">
            <AccordionTrigger>Formulaire Intake — Vue d'ensemble</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>Le formulaire Intake est le cœur de la configuration d'un projet. Il est organisé en <strong>7 onglets dynamiques</strong> :</p>
              <ol>
                <li><strong>Core</strong> — Paramètres fondamentaux du projet</li>
                <li><strong>Lieu</strong> — Onglet contextuel selon le type de projet (Établissement, Site Touristique ou Reconnaissance Parcours)</li>
                <li><strong>Terrain</strong> — POIs, zones Wi-Fi et zones interdites</li>
                <li><strong>Étapes</strong> — Configuration détaillée de chaque étape/POI</li>
                <li><strong>Règles</strong> — Scoring global, temps, indices, branchement</li>
                <li><strong>Exports</strong> — Génération de documents (PRD, Checklist, Prompt IA, Rapport HTML)</li>
              </ol>
              <h4>Fonctionnalités transversales</h4>
              <ul>
                <li><strong>Barre de navigation :</strong> Les onglets sont accessibles en haut du formulaire avec indication de progression.</li>
                <li><strong>Sauvegarde automatique :</strong> Chaque modification est persistée automatiquement en base de données.</li>
                <li><strong>Bandeau de synchronisation croisée :</strong> Le composant <em>CrossTabSummary</em> affiche un résumé cliquable des données partagées entre onglets avec alertes de cohérence.</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* 3. Onglet Core */}
          <AccordionItem value="core-tab">
            <AccordionTrigger>Onglet Core — Paramètres fondamentaux</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>L'onglet Core regroupe toute la configuration de base du projet :</p>

              <h4>Type de projet</h4>
              <ul>
                <li>🏨 <strong>Établissement</strong> — Hôtel, musée, parc d'attractions</li>
                <li>🏛️ <strong>Site Touristique</strong> — Ville, quartier, site naturel</li>
                <li>🗺️ <strong>Reconnaissance Parcours</strong> — Mode terrain avec enregistrement GPS</li>
              </ul>

              <h4>Type de quête</h4>
              <ul>
                <li><strong>Exploration</strong> — Parcours libre, les joueurs explorent à leur rythme</li>
                <li><strong>Séquentiel</strong> — Étapes à suivre dans un ordre précis</li>
                <li><strong>Course chrono</strong> — Contre la montre</li>
                <li><strong>Collaboratif</strong> — Les joueurs coopèrent pour avancer</li>
                <li><strong>Compétition équipes</strong> — Plusieurs équipes s'affrontent</li>
              </ul>

              <h4>Public cible</h4>
              <p>Multi-sélection parmi 7 options : Familles, Couples, Corporate, Ados, Seniors, Enfants, Amis.</p>

              <h4>Durée et difficulté</h4>
              <ul>
                <li><strong>Durée :</strong> Saisie manuelle (minutes) ou auto-calculée à partir des temps POI</li>
                <li><strong>Difficulté :</strong> Échelle de 1 à 5 (Facile → Extrême)</li>
              </ul>

              <h4>Langues</h4>
              <p>Français obligatoire + optionnel : Anglais, Arabe, Espagnol, Darija (ARY). Le contenu multilingue (titre et histoire) utilise des champs i18n dédiés.</p>

              <h4>Mode de jeu</h4>
              <ul>
                <li><strong>Solo</strong> — Un joueur seul</li>
                <li><strong>Équipes</strong> — Plusieurs équipes (config : nombre d'équipes, joueurs/équipe, mode compétition)</li>
                <li><strong>1 vs 1</strong> — Duel entre deux joueurs</li>
                <li><strong>Multi-joueurs (classement)</strong> — Solo avec classement partagé</li>
              </ul>

              <h4>Mode transport</h4>
              <p>Définit comment les joueurs se déplacent entre les étapes :</p>
              <ul>
                <li>🚶 À pied · 🚲 Vélo · 🚌 Bus · 🚗 Voiture · 🚢 Bateau · 🔀 Mixte</li>
              </ul>

              <h4>Storytelling</h4>
              <ul>
                <li><strong>Activation storytelling :</strong> Active le fil narratif de la quête</li>
                <li><strong>Narrateur :</strong> Nom et personnalité du personnage guide</li>
                <li><strong>Avatar :</strong> Configuration visuelle du narrateur (nom, style, âge, tenue, persona)</li>
              </ul>

              <h4>Décisions validées client</h4>
              <p>Checklist de 10 items à valider avec le client : QR codes autorisés, défis photo, staff impliqué, accessibilité PMR, etc.</p>
            </AccordionContent>
          </AccordionItem>

          {/* 4. Lieu — Établissement */}
          <AccordionItem value="establishment-tab">
            <AccordionTrigger>Onglet Lieu — Établissement</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>Affiché quand le type de projet est <Badge variant="outline">Établissement</Badge>.</p>
              <ul>
                <li><strong>Espaces :</strong> Liste des zones exploitables (lobby, chambres, restaurant, jardin…)</li>
                <li><strong>Zones privées :</strong> Zones interdites d'accès aux joueurs (cuisine, bureaux…)</li>
                <li><strong>Opérations staff :</strong> Notes sur l'implication du personnel</li>
                <li><strong>Notes Wi-Fi :</strong> Couverture réseau par zone</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* 5. Lieu — Site Touristique */}
          <AccordionItem value="tourist-tab">
            <AccordionTrigger>Onglet Lieu — Site Touristique</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>Affiché quand le type de projet est <Badge variant="outline">Site Touristique</Badge>.</p>
              <ul>
                <li><strong>Points de départ / arrivée :</strong> Coordonnées et description des points clés</li>
                <li><strong>Zones à éviter :</strong> Zones dangereuses, en travaux ou interdites</li>
                <li><strong>Créneaux horaires :</strong> Horaires d'ouverture/fermeture du site</li>
                <li><strong>Landmarks :</strong> Points de repère remarquables pour l'orientation</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* 6. Parcours — Reconnaissance GPS */}
          <AccordionItem value="route-recon-tab">
            <AccordionTrigger>Onglet Parcours — Reconnaissance GPS</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>Disponible pour les projets <Badge variant="outline">Reconnaissance Parcours</Badge>. Permet de faire un repérage terrain avec suivi GPS.</p>

              <h4>Enregistrement de trace</h4>
              <ul>
                <li><strong>Démarrer :</strong> Active le suivi GPS en temps réel</li>
                <li><strong>Modes :</strong> Marche (haute précision) ou Conduite (intervalle optimisé)</li>
                <li><strong>Arrêter :</strong> Sauvegarde la trace GeoJSON, la distance et la durée</li>
              </ul>

              <h4>Marqueurs</h4>
              <ul>
                <li>Posez des marqueurs aux points d'intérêt pendant l'enregistrement</li>
                <li>Chaque marqueur peut avoir : une <strong>note textuelle</strong>, une <strong>photo</strong>, un <strong>enregistrement vocal</strong></li>
                <li>Les marqueurs sont géolocalisés automatiquement</li>
              </ul>

              <h4>Conversion et exports</h4>
              <ul>
                <li><strong>Conversion :</strong> Les marqueurs peuvent être convertis en POIs pour l'onglet Étapes</li>
                <li><strong>Export GeoJSON :</strong> Trace GPS brute</li>
                <li><strong>Export CSV :</strong> Tableau des marqueurs</li>
                <li><strong>Export ZIP :</strong> Bundle complet (trace + marqueurs + médias)</li>
              </ul>

              <h4>Guidage temps réel</h4>
              <p>Mode navigation avec carte interactive, position en direct, et indicateurs de progression.</p>

              <h4>Rapport interactif</h4>
              <p>Génération d'un fichier HTML autonome avec carte, tableau POI éditable, et exports intégrés. Voir l'onglet « Rapport interactif » pour plus de détails.</p>

              <p className="text-muted-foreground text-xs">Note : Le GPS peut mettre quelques secondes à s'accrocher. Le système réessaie automatiquement en cas de timeout.</p>
            </AccordionContent>
          </AccordionItem>

          {/* 7. Terrain */}
          <AccordionItem value="fieldwork-tab">
            <AccordionTrigger>Onglet Terrain — POIs et zones</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>L'onglet Terrain gère les Points d'Intérêt (POIs) et les zones du projet :</p>

              <h4>POIs (Points d'Intérêt)</h4>
              <p>Chaque POI est une carte avec :</p>
              <ul>
                <li><strong>Nom</strong> — Identifiant du point</li>
                <li><strong>Zone</strong> — Localisation dans l'espace</li>
                <li><strong>Photo</strong> — Image de référence (upload)</li>
                <li><strong>Type d'interaction</strong> — Puzzle, QR scan, Photo, Objet caché, NPC, Audio, Storytelling, Vidéo</li>
                <li><strong>Niveau de risque</strong> — Bas, Moyen, Haut</li>
                <li><strong>Temps estimé</strong> — Minutes depuis le POI précédent</li>
                <li><strong>Types d'étapes</strong> — Multi-sélection des 14 types disponibles</li>
                <li><strong>Modes de validation</strong> — Multi-sélection des 6 modes</li>
              </ul>

              <h4>Zones Wi-Fi</h4>
              <p>Cartographie de la couverture réseau par zone : OK, Faible, Mort.</p>

              <h4>Zones interdites</h4>
              <p>Liste des zones d'accès interdit avec raison.</p>
            </AccordionContent>
          </AccordionItem>

          {/* 8. Étapes */}
          <AccordionItem value="steps-tab">
            <AccordionTrigger>Onglet Étapes — Configuration détaillée</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>L'onglet Étapes permet de configurer en détail chaque POI du jeu :</p>

              <h4>Configuration par étape</h4>
              <ul>
                <li><strong>Type d'étape :</strong> Parmi 14 types (voir tableau ci-dessous)</li>
                <li><strong>Mode de validation :</strong> Parmi 6 modes (voir tableau ci-dessous)</li>
                <li><strong>Scoring :</strong> Points attribués, pénalité erreur, bonus temps</li>
                <li><strong>Indices :</strong> Jusqu'à N indices par étape, avec révélation automatique optionnelle</li>
                <li><strong>Branchement conditionnel :</strong> Redirection selon succès/échec ou score au-dessus/en-dessous d'un seuil</li>
                <li><strong>Validation photo :</strong> Libre, Référence (comparaison avec image), ou QR code</li>
                <li><strong>Contenu i18n :</strong> Titre, description et indices multilingues</li>
                <li><strong>Préréglages :</strong> Application de presets pour pré-remplir la configuration</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* 9. Règles */}
          <AccordionItem value="rules-tab">
            <AccordionTrigger>Onglet Règles — Scoring et paramètres globaux</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <h4>Scoring global</h4>
              <ul>
                <li><strong>Points par défaut :</strong> Score attribué pour chaque étape réussie</li>
                <li><strong>Pénalité indice :</strong> Points retirés quand un joueur utilise un indice</li>
                <li><strong>Pénalité échec :</strong> Points retirés en cas d'échec</li>
              </ul>

              <h4>Temps</h4>
              <ul>
                <li><strong>Temps limite global :</strong> Durée maximale de la quête</li>
                <li><strong>Bonus temps :</strong> Points supplémentaires pour finir en avance</li>
              </ul>

              <h4>Indices</h4>
              <ul>
                <li><strong>Maximum d'indices :</strong> Nombre max par étape</li>
                <li><strong>Auto-reveal :</strong> Révélation automatique après X secondes d'inactivité</li>
              </ul>

              <h4>Branchement</h4>
              <ul>
                <li><strong>On success / On failure :</strong> Étape suivante conditionnelle</li>
                <li><strong>Score above / below :</strong> Redirection selon le score cumulé</li>
              </ul>

              <h4>Team vs Solo</h4>
              <p>Les règles s'adaptent au mode de jeu sélectionné dans Core (scoring partagé, classement individuel, etc.).</p>
            </AccordionContent>
          </AccordionItem>

          {/* 10. Exports */}
          <AccordionItem value="exports-tab">
            <AccordionTrigger>Onglet Exports — Documents générés</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>4 types de documents peuvent être générés côté client :</p>
              <ul>
                <li><strong>Checklist terrain :</strong> Récapitulatif des zones, Wi-Fi, contraintes pour la visite sur site</li>
                <li><strong>PRD (Product Requirements Document) :</strong> Spécifications complètes pour le développement</li>
                <li><strong>Prompt IA :</strong> Prompt pré-formaté pour générer du contenu avec une IA</li>
                <li><strong>Rapport interactif HTML :</strong> Fichier HTML autonome avec toutes les données, carte et exports intégrés</li>
              </ul>
              <p>Pour les projets <Badge variant="outline">Reconnaissance Parcours</Badge>, deux exports supplémentaires :</p>
              <ul>
                <li><strong>Rapport interactif :</strong> Avec carte de la trace GPS et tableau POI éditable</li>
                <li><strong>Road Book cartographique :</strong> Carte avec itinéraire et points repères</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* 11. Synchronisation croisée */}
          <AccordionItem value="cross-tab">
            <AccordionTrigger>Synchronisation croisée entre onglets</AccordionTrigger>
            <AccordionContent className="prose prose-sm max-w-none text-foreground">
              <p>Le bandeau <strong>CrossTabSummary</strong> apparaît en haut du formulaire et assure la cohérence des données :</p>
              <ul>
                <li><strong>Badges cliquables :</strong> Résumé des POIs, zones, durée — cliquez pour naviguer vers l'onglet source</li>
                <li><strong>Alertes de cohérence :</strong> Avertissements si des données sont incohérentes entre onglets (ex : POI sans zone définie)</li>
                <li><strong>Auto-calcul durée :</strong> La durée totale est recalculée automatiquement à partir des temps individuels des POIs</li>
                <li><strong>Données partagées :</strong> Les types d'étapes et modes de validation sélectionnés dans Terrain sont reflétés dans Étapes</li>
              </ul>
            </AccordionContent>
          </AccordionItem>

          {/* 12. Types d'étapes — Tableau */}
          <AccordionItem value="step-types-table">
            <AccordionTrigger>Tableau des 14 types d'étapes</AccordionTrigger>
            <AccordionContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[160px]">Type</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ['Narration (story)', 'Texte narratif lu par le joueur, avance l\'histoire'],
                    ['Information', 'Contenu informatif ou pédagogique, pas de validation requise'],
                    ['QCM', 'Question à choix multiples avec une ou plusieurs bonnes réponses'],
                    ['Énigme', 'Problème logique ou puzzle à résoudre'],
                    ['Code secret', 'Le joueur doit saisir un code (numérique ou textuel)'],
                    ['Pendu', 'Jeu de lettres type pendu pour deviner un mot/phrase'],
                    ['Memory', 'Jeu de mémoire avec paires à retrouver'],
                    ['Photo', 'Le joueur doit prendre ou identifier une photo'],
                    ['Terrain', 'Activité physique ou exploration sur place'],
                    ['Défi', 'Challenge créatif ou sportif à accomplir'],
                    ['Transition', 'Étape de liaison entre deux points, pas de gameplay'],
                    ['QR Code', 'Scan d\'un QR code physique pour débloquer le contenu'],
                    ['Info QR', 'Affichage d\'informations après scan d\'un QR code'],
                    ['Compte à rebours', 'Étape avec timer imposé, action requise avant expiration'],
                  ].map(([type, desc]) => (
                    <TableRow key={type}>
                      <TableCell className="font-medium">{type}</TableCell>
                      <TableCell className="text-muted-foreground">{desc}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>

          {/* 13. Modes de validation — Tableau */}
          <AccordionItem value="validation-modes-table">
            <AccordionTrigger>Tableau des 6 modes de validation</AccordionTrigger>
            <AccordionContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[180px]">Mode</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    ['QR Code', 'Le joueur scanne un QR code physique pour valider l\'étape'],
                    ['Photo', 'Validation par prise de photo (libre, comparaison ou QR)'],
                    ['Code', 'Saisie d\'un code secret textuel ou numérique'],
                    ['Manuel', 'Un animateur ou le staff valide manuellement'],
                    ['Libre', 'Pas de validation requise, le joueur passe à la suite'],
                    ['Chaîne de validation', 'Plusieurs validations enchaînées requises (ex : code + photo)'],
                  ].map(([mode, desc]) => (
                    <TableRow key={mode}>
                      <TableCell className="font-medium">{mode}</TableCell>
                      <TableCell className="text-muted-foreground">{desc}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
