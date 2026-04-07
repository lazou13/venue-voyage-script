import { type QuestResult as QuestResultType, type Stop } from "@/hooks/useQuestEngine";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ChevronDown, Camera, AlertTriangle } from "lucide-react";

// ━━━━━━━━━━━━━━ PROPS ━━━━━━━━━━━━━━

interface QuestResultProps {
  result: QuestResultType | null;
  onRestart: () => void;
}

// ━━━━━━━━━━━━━━ HELPERS ━━━━━━━━━━━━━━

function fmtDuration(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h${m.toString().padStart(2, "0")}` : `${h}h`;
  }
  return `${min} min`;
}

function fmtDistance(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m}m`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ━━━━━━━━━━━━━━ CATEGORY FALLBACKS ━━━━━━━━━━━━━━

const CATEGORY_FALLBACKS: Record<string, string> = {
  monument: "Architecture remarquable, décorations traditionnelles, inscriptions historiques",
  fontaine: "Zelliges colorés, travail du bois, bassin central avec mosaïques",
  fountain: "Zelliges colorés, travail du bois, bassin central avec mosaïques",
  mosquee: "Minaret élancé, cour intérieure (non accessible aux non-musulmans)",
  mosque: "Minaret élancé, cour intérieure (non accessible aux non-musulmans)",
  palais: "Cours intérieures, jardins, salles décorées, plafonds peints",
  palace: "Cours intérieures, jardins, salles décorées, plafonds peints",
  medersa: "Cellules étudiantes, salle de prière, patio avec bassin central",
  souk: "Étals artisanaux, ambiance authentique, produits locaux traditionnels",
  market: "Étals artisanaux, ambiance authentique, produits locaux traditionnels",
  musee: "Collections permanentes et temporaires, architecture du bâtiment",
  museum: "Collections permanentes et temporaires, architecture du bâtiment",
  jardin: "Végétation luxuriante, bassins, architecture paysagère mauresque",
  garden: "Végétation luxuriante, bassins, architecture paysagère mauresque",
  riad: "Patio central à ciel ouvert, fontaine, décoration zellige traditionnelle",
  porte: "Architecture défensive médiévale, décorations sculptées",
  gate_bab: "Architecture défensive médiévale, décorations sculptées",
  place: "Animation locale, vie quotidienne marocaine, ambiance authentique",
  plaza: "Animation locale, vie quotidienne marocaine, ambiance authentique",
  restaurant: "Cuisine locale, décor traditionnel, ambiance typique",
  cafe: "Terrasse avec vue, thé à la menthe, pâtisseries marocaines",
  craft_shop: "Artisanat traditionnel, savoir-faire ancestral",
  fondouk: "Architecture de caravansérail, cour intérieure, ateliers d'artisans",
  tomb: "Architecture funéraire, décorations de stuc et zelliges",
  shrine_zaouia: "Architecture religieuse, décor sacré, atmosphère spirituelle",
  hammam: "Architecture traditionnelle, coupoles à étoiles, rituels de bain",
  gallery: "Expositions artistiques, architecture rénovée",
};

// ━━━━━━━━━━━━━━ COMPONENT ━━━━━━━━━━━━━━

export default function QuestResult({ result, onRestart }: QuestResultProps) {
  const { toast } = useToast();

  if (!result) return null;

  const stops = result.stops ?? [];
  const isTreasure = result.mode === "treasure_hunt";

  const handleShare = async () => {
    const text = `${result.title}\n${result.teaser}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: result.title, text: result.teaser });
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(text);
      toast({ title: "Lien copié !" });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── SECTION 1 — Header ── */}
      <div>
        <h2 className="text-2xl font-bold">{result.title}</h2>
        <p className="text-muted-foreground text-sm mt-1">{result.teaser}</p>
        <div className="flex flex-wrap gap-2 mt-3">
          {isTreasure ? (
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
              🗺️ Chasse au trésor
            </Badge>
          ) : (
            <Badge className="bg-teal-100 text-teal-800 hover:bg-teal-100">
              🧭 Visite guidée
            </Badge>
          )}
          {isTreasure && (
            <Badge variant="outline">
              {result.difficulty === "easy"
                ? "😊 Facile"
                : result.difficulty === "medium"
                  ? "🧩 Moyen"
                  : "💀 Difficile"}
            </Badge>
          )}
          <Badge variant="secondary">{capitalize(result.theme)}</Badge>
        </div>
      </div>

      {/* ── SECTION 2 — Métriques ── */}
      <div
        className={`grid gap-3 ${isTreasure ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-2 sm:grid-cols-3"}`}
      >
        <Card>
          <CardContent className="py-4 px-3">
            <span className="text-xs text-muted-foreground">🕐 Durée totale</span>
            <p className="text-xl font-bold">{fmtDuration(result.total_time_min)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-3">
            <span className="text-xs text-muted-foreground">📍 Étapes</span>
            <p className="text-xl font-bold">{result.total_stops} étapes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 px-3">
            <span className="text-xs text-muted-foreground">🚶 Distance</span>
            <p className="text-xl font-bold">{fmtDistance(result.total_distance_m)}</p>
          </CardContent>
        </Card>
        {isTreasure && (
          <Card>
            <CardContent className="py-4 px-3">
              <span className="text-xs text-muted-foreground">⭐ Points</span>
              <p className="text-xl font-bold">{result.total_points} pts</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── SECTION 3 — Timeline ── */}
      <div className="relative border-l-2 border-muted ml-4 pl-6 flex flex-col gap-4">
        {stops.map((stop, idx) => (
          <div key={stop.poi_id} className="relative">
            <div className="absolute -left-[calc(1.5rem+1px)] top-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              {stop.order}
            </div>
            <span className="font-medium">{stop.name}</span>
            <Badge variant="outline" className="ml-2 text-xs">
              {stop.category}
            </Badge>
            {idx < stops.length - 1 && (
              <div className="text-xs text-muted-foreground mt-2">
                🚶 {stop.walk_time_min} min · {stop.distance_from_prev_m}m
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── SECTION 4 — Accordéon détails ── */}
      {stops.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Aucune étape générée
        </p>
      ) : (
        <Accordion type="single" collapsible defaultValue="stop-1">
          {stops.map((stop) => (
            <AccordionItem key={stop.poi_id} value={`stop-${stop.order}`}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2 flex-wrap text-left">
                  <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                    {stop.order}
                  </span>
                  <span className="font-medium">{stop.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {stop.category}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    🚶 {stop.walk_time_min}min
                  </Badge>
                </div>
              </AccordionTrigger>

              <AccordionContent>
                {isTreasure ? (
                  <TreasureContent stop={stop} />
                ) : (
                  <GuidedContent stop={stop} />
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* ── SECTION 5 — Actions ── */}
      <div className="flex gap-3 mt-6">
        <Button variant="outline" onClick={onRestart}>
          ← Recommencer
        </Button>
        <Button onClick={handleShare}>Partager ce parcours</Button>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━ SUB-COMPONENTS ━━━━━━━━━━━━━━

function TreasureContent({ stop }: { stop: Stop }) {
  return (
    <div className="flex flex-col gap-3">
      {stop.riddle && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
          <span className="text-xs font-medium text-amber-700 mb-2 block">
            🔍 Énigme
          </span>
          <p className="text-sm">{stop.riddle}</p>
        </div>
      )}
      {stop.challenge && (
        <div className="rounded-lg bg-orange-50 border border-orange-200 p-4">
          <span className="text-xs font-medium text-orange-700 mb-2 block">
            💪 Défi
          </span>
          <p className="text-sm">{stop.challenge}</p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {stop.points != null && (
          <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">
            ⭐ {stop.points} pts
          </Badge>
        )}
        {stop.validation_radius_m != null && (
          <Badge variant="outline">📍 Valider dans {stop.validation_radius_m}m</Badge>
        )}
      </div>
    </div>
  );
}

function GuidedContent({ stop }: { stop: Stop }) {
  const categoryKey = stop.category?.toLowerCase() || "";
  const mustSeeFallback = CATEGORY_FALLBACKS[categoryKey];

  return (
    <div className="flex flex-col gap-3">
      {stop.story && <p className="text-sm">{stop.story}</p>}

      {stop.history_context && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <span className="text-xs font-medium text-blue-700 mb-1 block">
            🏛️ Histoire du lieu
          </span>
          <p className="text-sm">{stop.history_context}</p>
        </div>
      )}

      {stop.local_anecdote && (
        <p className="italic text-muted-foreground text-sm">
          «&nbsp;{stop.local_anecdote}&nbsp;»
        </p>
      )}

      {stop.fun_fact && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <span className="text-xs font-medium text-amber-700 mb-1 block">
            💡 Le saviez-vous ?
          </span>
          <p className="text-sm">{stop.fun_fact}</p>
        </div>
      )}

      {(stop.price_info || stop.opening_hours || stop.must_see_details) && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
            <ChevronDown className="h-4 w-4" />
            ℹ️ Infos pratiques
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2 pl-6">
            {stop.price_info && (
              <p className="text-sm">
                <span className="font-medium">Tarif :</span> {stop.price_info}
              </p>
            )}
            {stop.opening_hours && (
              <div className="text-sm">
                <p className="font-medium mb-1">Horaires :</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                  {Object.entries(stop.opening_hours).map(([day, hours]) => (
                    <div key={day} className="contents">
                      <span className="text-muted-foreground">{day}</span>
                      <span>{hours}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {stop.must_see_details && (
              <p className="text-sm">
                <span className="font-medium">À ne pas manquer :</span> {stop.must_see_details}
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}

      {(stop.must_see_details || mustSeeFallback) && !stop.price_info && !stop.opening_hours && (
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
          <span className="text-xs font-medium text-teal-700 mb-1 block">
            👁️ À voir
          </span>
          {stop.must_see_details ? (
            <p className="text-sm">{stop.must_see_details}</p>
          ) : (
            <p className="text-sm italic text-muted-foreground">{mustSeeFallback}</p>
          )}
        </div>
      )}

      {stop.must_try && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <span className="text-xs font-medium text-orange-700 mb-1 block">
            🍽️ À tester
          </span>
          <p className="text-sm">{stop.must_try}</p>
        </div>
      )}

      {stop.must_visit_nearby && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <span className="text-xs font-medium text-purple-700 mb-1 block">
            🗺️ À visiter à proximité
          </span>
          <p className="text-sm">{stop.must_visit_nearby}</p>
        </div>
      )}

      {stop.tourist_tips && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <span className="text-xs font-medium text-yellow-700 mb-1 block">
            💡 Conseil pratique
          </span>
          <p className="text-sm">{stop.tourist_tips}</p>
        </div>
      )}

      {stop.is_photo_spot && stop.photo_tip && (
        <div className="flex items-start gap-3 bg-pink-50 border border-pink-200 rounded-lg p-4">
          <Camera className="h-5 w-5 text-pink-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-medium text-pink-700">📸 Spot photo recommandé</p>
            <p className="text-sm mt-1">{stop.photo_tip}</p>
          </div>
        </div>
      )}

      {stop.photo_spot && !stop.photo_tip && (
        <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-100 w-fit">
          📸 Photo spot
        </Badge>
      )}

      {stop.ruelle_etroite && (
        <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>⚠️ Passage par ruelles étroites — attention aux motos et charrettes</span>
        </div>
      )}
    </div>
  );
}
