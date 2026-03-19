import { type QuestResult as QuestResultType, type Stop } from "@/hooks/useQuestEngine";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

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
            {/* Circle */}
            <div className="absolute -left-[calc(1.5rem+1px)] top-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
              {stop.order}
            </div>
            <span className="font-medium">{stop.name}</span>
            <Badge variant="outline" className="ml-2 text-xs">
              {stop.category}
            </Badge>
            {/* Walk segment */}
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
  return (
    <div className="flex flex-col gap-3">
      {stop.story && <p className="text-sm">{stop.story}</p>}
      {stop.history_context && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <span className="text-xs font-medium text-blue-700 mb-1 block">
            🏛️ Le saviez-vous ?
          </span>
          <p className="text-sm">{stop.history_context}</p>
        </div>
      )}
      {stop.local_anecdote && (
        <p className="italic text-muted-foreground text-sm">
          «&nbsp;{stop.local_anecdote}&nbsp;»
        </p>
      )}
      {stop.tourist_tips && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <span className="text-xs font-medium text-yellow-700 mb-1 block">
            💡 Conseil pratique
          </span>
          <p className="text-sm">{stop.tourist_tips}</p>
        </div>
      )}
      {stop.photo_spot && (
        <Badge className="bg-pink-100 text-pink-700 hover:bg-pink-100 w-fit">
          📸 Photo spot
        </Badge>
      )}
    </div>
  );
}
