/**
 * POI display naming policy — FR-first.
 * Order of fallback: name_fr → name → name_en → "Sans nom".
 * Use this helper everywhere a POI name is shown to the user.
 */
export interface NamedPOI {
  name?: string | null;
  name_fr?: string | null;
  name_en?: string | null;
}

export function getDisplayName(poi: NamedPOI | null | undefined): string {
  if (!poi) return 'Sans nom';
  const fr = poi.name_fr?.trim();
  if (fr) return fr;
  const base = poi.name?.trim();
  if (base) return base;
  const en = poi.name_en?.trim();
  if (en) return en;
  return 'Sans nom';
}
