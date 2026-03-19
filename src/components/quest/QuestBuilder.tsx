import { useState } from "react";
import {
  useQuestEngine,
  type QuestResult,
  type EngineMode,
  type Theme,
  type Audience,
  type Difficulty,
} from "@/hooks/useQuestEngine";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import { Loader2 } from "lucide-react";

// ━━━━━━━━━━━━━━ PROPS ━━━━━━━━━━━━━━

interface QuestBuilderProps {
  startLat: number;
  startLng: number;
  startName?: string;
  onQuestGenerated: (result: QuestResult) => void;
}

// ━━━━━━━━━━━━━━ DATA ━━━━━━━━━━━━━━

const THEMES: { value: Theme; emoji: string; label: string }[] = [
  { value: "architecture", emoji: "🏛️", label: "Architecture" },
  { value: "artisan", emoji: "🪵", label: "Artisanat" },
  { value: "hidden_gems", emoji: "💎", label: "Secrets" },
  { value: "food", emoji: "🍵", label: "Saveurs" },
  { value: "family", emoji: "👨‍👩‍👧", label: "Famille" },
  { value: "history", emoji: "📜", label: "Histoire" },
  { value: "photography", emoji: "📸", label: "Photo" },
  { value: "complete", emoji: "✨", label: "Complet" },
];

const AUDIENCES: { value: Audience; label: string }[] = [
  { value: "solo", label: "Solo" },
  { value: "couple", label: "Couple" },
  { value: "family", label: "Famille" },
  { value: "friends", label: "Amis" },
  { value: "school", label: "École" },
  { value: "teambuilding", label: "Team" },
  { value: "vip", label: "VIP" },
  { value: "tourist", label: "Touriste" },
];

const DIFFICULTIES: { value: Difficulty; emoji: string; label: string }[] = [
  { value: "easy", emoji: "😊", label: "Facile" },
  { value: "medium", emoji: "🧩", label: "Moyen" },
  { value: "hard", emoji: "💀", label: "Difficile" },
];

// ━━━━━━━━━━━━━━ HELPERS ━━━━━━━━━━━━━━

function formatDuration(min: number): string {
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  }
  return `${min} min`;
}

function formatRadius(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`;
}

// ━━━━━━━━━━━━━━ COMPONENT ━━━━━━━━━━━━━━

export default function QuestBuilder({
  startLat,
  startLng,
  startName,
  onQuestGenerated,
}: QuestBuilderProps) {
  const { generate, isLoading, error } = useQuestEngine();

  // State
  const [mode, setMode] = useState<EngineMode>("treasure_hunt");
  const [theme, setTheme] = useState<Theme>("complete");
  const [audience, setAudience] = useState<Audience>("tourist");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [maxDuration, setMaxDuration] = useState(90);
  const [maxStops, setMaxStops] = useState(6);
  const [radius, setRadius] = useState(800);
  const [includeFoodBreak, setIncludeFoodBreak] = useState(true);
  const [circular, setCircular] = useState(false);
  const [photoSpotsPriority, setPhotoSpotsPriority] = useState(false);

  const isTreasure = mode === "treasure_hunt";
  const canGenerate = !(startLat === 0 && startLng === 0);

  const handleGenerate = async () => {
    const result = await generate({
      start_lat: startLat,
      start_lng: startLng,
      start_name: startName,
      mode,
      theme,
      audience,
      difficulty,
      max_duration_min: maxDuration,
      radius_m: radius,
      max_stops: maxStops,
      include_food_break: includeFoodBreak,
      circular,
      language: "fr",
    });
    if (result) onQuestGenerated(result);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* BLOC 1 — Mode */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card
          className={`cursor-pointer transition-all ${
            isTreasure
              ? "border-2 border-amber-500"
              : "border border-border"
          }`}
          onClick={() => setMode("treasure_hunt")}
        >
          <CardContent className="flex flex-col items-center gap-1 py-5">
            <span className="text-3xl">🗺️</span>
            <span className="font-semibold">Chasse au trésor</span>
            <span className="text-xs text-muted-foreground">
              Énigmes · Points · Chrono
            </span>
          </CardContent>
        </Card>
        <Card
          className={`cursor-pointer transition-all ${
            !isTreasure
              ? "border-2 border-teal-500"
              : "border border-border"
          }`}
          onClick={() => setMode("guided_tour")}
        >
          <CardContent className="flex flex-col items-center gap-1 py-5">
            <span className="text-3xl">🧭</span>
            <span className="font-semibold">Visite guidée</span>
            <span className="text-xs text-muted-foreground">
              Libre · Authentique · Sans commission
            </span>
          </CardContent>
        </Card>
      </div>

      {/* BLOC 2 — Thème */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Thème</span>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {THEMES.map((t) => (
            <button
              key={t.value}
              onClick={() => setTheme(t.value)}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                theme === t.value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {t.emoji} {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* BLOC 3 — Sliders */}
      <div className="flex flex-col gap-5">
        {/* Duration */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Durée</span>
            <span className="text-sm text-muted-foreground">
              {formatDuration(maxDuration)}
            </span>
          </div>
          <Slider
            min={30}
            max={240}
            step={15}
            value={[maxDuration]}
            onValueChange={([v]) => setMaxDuration(v)}
          />
        </div>

        {/* Stops */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Étapes</span>
            <span className="text-sm text-muted-foreground">
              {maxStops} étapes
            </span>
          </div>
          <Slider
            min={3}
            max={12}
            step={1}
            value={[maxStops]}
            onValueChange={([v]) => setMaxStops(v)}
          />
        </div>

        {/* Radius */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Rayon</span>
            <span className="text-sm text-muted-foreground">
              {formatRadius(radius)}
            </span>
          </div>
          <Slider
            min={200}
            max={1500}
            step={100}
            value={[radius]}
            onValueChange={([v]) => setRadius(v)}
          />
        </div>
      </div>

      {/* BLOC 4 — Toggles */}
      <div className="flex flex-col gap-3">
        <label className="flex items-center justify-between">
          <span className="text-sm">Pause café ou resto</span>
          <Switch
            checked={includeFoodBreak}
            onCheckedChange={setIncludeFoodBreak}
          />
        </label>
        <label className="flex items-center justify-between">
          <span className="text-sm">Circuit circulaire (retour au départ)</span>
          <Switch checked={circular} onCheckedChange={setCircular} />
        </label>
        {theme === "photography" && (
          <label className="flex items-center justify-between">
            <span className="text-sm">Mettre en avant les photo spots</span>
            <Switch
              checked={photoSpotsPriority}
              onCheckedChange={setPhotoSpotsPriority}
            />
          </label>
        )}
      </div>

      {/* BLOC 5 — Public */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Public</span>
        <div className="flex flex-wrap gap-2">
          {AUDIENCES.map((a) => (
            <button
              key={a.value}
              onClick={() => setAudience(a.value)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                audience === a.value
                  ? "bg-primary text-primary-foreground"
                  : "border border-border hover:bg-secondary"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* BLOC 6 — Difficulté (treasure_hunt only) */}
      {isTreasure && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Difficulté</span>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTIES.map((d) => (
              <Button
                key={d.value}
                variant={difficulty === d.value ? "default" : "outline"}
                size="sm"
                onClick={() => setDifficulty(d.value)}
                className="w-full"
              >
                {d.emoji} {d.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* BLOC 7 — Bouton Générer */}
      <Button
        size="lg"
        className={`w-full ${
          isTreasure
            ? "bg-amber-500 hover:bg-amber-600 text-white"
            : "bg-teal-600 hover:bg-teal-700 text-white"
        }`}
        disabled={!canGenerate || isLoading}
        onClick={handleGenerate}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Génération en cours...
          </>
        ) : (
          "Générer mon parcours →"
        )}
      </Button>

      {/* BLOC 8 — Erreur */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
