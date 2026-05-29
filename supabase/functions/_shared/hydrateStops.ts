// Helper partagé : hydrate les stops d'une visite avec les champs inline
// (anecdote + audios FR/EN) en lisant medina_pois par poi_id.
//
// Règles strictes :
//  - Préserve l'ordre exact des stops
//  - N'écrase JAMAIS un champ déjà non vide côté stop
//  - Ne touche JAMAIS à mini_challenge, riddle, description, photo_url,
//    must_see_details, must_try, nearby_places, suggested_type, order,
//    poi_id, name, category, lat, lng, story, photo_tip,
//    walk_time_min, visit_time_min, distance_from_prev_m
//  - Une seule requête DB (in()) — pas d'écriture
//
// Utilisable depuis n'importe quelle edge function avec un client supabase
// (anon ou service role).

// deno-lint-ignore no-explicit-any
type AnyStop = Record<string, any>;
// deno-lint-ignore no-explicit-any
type SupabaseLike = any;

function isBlank(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string" && v.trim() === "") return true;
  return false;
}

export async function hydrateStopsFromPois(
  supabase: SupabaseLike,
  stops: AnyStop[] | null | undefined,
): Promise<AnyStop[]> {
  if (!Array.isArray(stops) || stops.length === 0) return stops ?? [];

  // 1. Collecter les poi_id distincts
  const ids = Array.from(
    new Set(
      stops
        .map((s) => s?.poi_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  );

  if (ids.length === 0) return stops;

  // 2. Une seule requête lecture
  const { data: pois, error } = await supabase
    .from("medina_pois")
    .select(
      "id, local_anecdote_fr, local_anecdote_en, audio_url_fr, audio_url_en, anecdote_audio_url_fr, anecdote_audio_url_en, history_context, history_context_en",
    )
    .in("id", ids);

  if (error || !pois) return stops;

  const byId = new Map<string, AnyStop>();
  for (const p of pois as AnyStop[]) byId.set(p.id, p);

  // 3. Hydratation additive, ordre préservé
  return stops.map((stop) => {
    const poi = stop?.poi_id ? byId.get(stop.poi_id) : undefined;
    if (!poi) return stop;

    const next: AnyStop = { ...stop };

    if (isBlank(next.anecdote) && !isBlank(poi.local_anecdote_fr)) {
      next.anecdote = poi.local_anecdote_fr;
    }
    if (isBlank(next.anecdote_en) && !isBlank(poi.local_anecdote_en)) {
      next.anecdote_en = poi.local_anecdote_en;
    }
    if (isBlank(next.audio_url_fr) && !isBlank(poi.audio_url_fr)) {
      next.audio_url_fr = poi.audio_url_fr;
    }
    if (isBlank(next.audio_url_en) && !isBlank(poi.audio_url_en)) {
      next.audio_url_en = poi.audio_url_en;
    }
    if (
      isBlank(next.anecdote_audio_url_fr) &&
      !isBlank(poi.anecdote_audio_url_fr)
    ) {
      next.anecdote_audio_url_fr = poi.anecdote_audio_url_fr;
    }
    if (
      isBlank(next.anecdote_audio_url_en) &&
      !isBlank(poi.anecdote_audio_url_en)
    ) {
      next.anecdote_audio_url_en = poi.anecdote_audio_url_en;
    }
    if (isBlank(next.story) && !isBlank(poi.history_context)) {
      next.story = poi.history_context;
    }
    if (isBlank(next.story_en) && !isBlank(poi.history_context_en)) {
      next.story_en = poi.history_context_en;
    }
    if (isBlank(next.history_context) && !isBlank(poi.history_context)) {
      next.history_context = poi.history_context;
    }
    if (isBlank(next.history_context_en) && !isBlank(poi.history_context_en)) {
      next.history_context_en = poi.history_context_en;
    }

    return next;
  });
}
