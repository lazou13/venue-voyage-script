import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NarrativeLayer } from "@/types/narrative";

interface EpisodeViewProps {
  narrative: NarrativeLayer;
}

/**
 * Rendu "Série interactive géolocalisée" (product_type: geo_series).
 * N'est affiché QUE si step_config.narrative_layer est valide.
 * N'affiche aucun champ PR1 — ces blocs sont gérés par le fallback dans QuestPlay.
 */
export function EpisodeView({ narrative }: EpisodeViewProps) {
  const { series, episode, guide } = narrative;
  const epNum = episode?.number;
  const epTotal = episode?.total;

  return (
    <div className="space-y-4">
      {/* En-tête série */}
      {series?.title && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            📺 {series.title}
          </Badge>
          {typeof epNum === "number" && typeof epTotal === "number" && (
            <Badge variant="outline" className="text-xs">
              Épisode {epNum}/{epTotal}
            </Badge>
          )}
        </div>
      )}

      {/* Titre épisode */}
      {episode?.title && (
        <div>
          <h3 className="text-lg font-bold leading-tight">{episode.title}</h3>
          {episode.emotion && (
            <p className="text-xs text-muted-foreground mt-1 italic">
              · {episode.emotion} ·
            </p>
          )}
        </div>
      )}

      {/* Hook */}
      {episode?.hook && (
        <p className="text-base font-medium leading-snug border-l-2 border-primary pl-3">
          {episode.hook}
        </p>
      )}

      {/* Arrival script (guide) */}
      {guide?.arrival_script && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🎙 Le guide</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {guide.arrival_script}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scène — ligne par ligne */}
      {episode?.scene && episode.scene.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🎬 La scène</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {episode.scene.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed">
                {line}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Le secret */}
      {episode?.secret && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🤫 Le secret</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {episode.secret}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Mission */}
      {episode?.mission && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🎭 Mission</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {episode.mission.title && (
              <p className="font-semibold">{episode.mission.title}</p>
            )}
            {episode.mission.instruction && (
              <p className="leading-relaxed">{episode.mission.instruction}</p>
            )}
            {episode.mission.caption && (
              <p className="italic text-muted-foreground">
                « {episode.mission.caption} »
              </p>
            )}
            {episode.mission.photo_required && (
              <Badge variant="outline" className="text-xs">
                📷 Photo requise
              </Badge>
            )}
            {episode.mission.respect_rules && (
              <p className="text-xs text-muted-foreground border-l-2 border-muted pl-2 mt-2">
                ⚠️ {episode.mission.respect_rules}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Révélation */}
      {episode?.revelation && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">💥 Révélation</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {episode.revelation}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Cliffhanger */}
      {episode?.cliffhanger && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">🎬 Cliffhanger</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap leading-relaxed font-medium">
              {episode.cliffhanger}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Transition vers le prochain épisode */}
      {episode?.transition_to_next && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">➡ Prochain épisode</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-muted-foreground">
              {episode.transition_to_next}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Demander au guide — disabled */}
      <Button disabled className="w-full">
        🎙 Demander au guide
      </Button>
      <p className="text-xs text-muted-foreground text-center">
        Bientôt disponible
      </p>
    </div>
  );
}
