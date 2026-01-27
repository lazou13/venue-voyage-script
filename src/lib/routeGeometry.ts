/**
 * Route Geometry Helpers
 * Utilities for snapping to polylines and computing progress along routes
 */

export interface Coord {
  lat: number;
  lng: number;
}

export interface SnapResult {
  nearestPoint: Coord;
  nearestSegmentIndex: number;
  distanceToLineMeters: number;
  progressMetersAlongLine: number;
}

export interface ProgressPolyline {
  completedCoords: [number, number][]; // [lng, lat]
  remainingCoords: [number, number][];
}

/**
 * Calculate distance between two points using Haversine formula
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Find the nearest point on a line segment to a given point
 */
function nearestPointOnSegment(
  p: Coord,
  a: Coord,
  b: Coord
): { point: Coord; t: number } {
  const dx = b.lng - a.lng;
  const dy = b.lat - a.lat;
  
  if (dx === 0 && dy === 0) {
    return { point: a, t: 0 };
  }
  
  const t = Math.max(0, Math.min(1, 
    ((p.lng - a.lng) * dx + (p.lat - a.lat) * dy) / (dx * dx + dy * dy)
  ));
  
  return {
    point: {
      lat: a.lat + t * dy,
      lng: a.lng + t * dx,
    },
    t,
  };
}

/**
 * Calculate cumulative distances along a polyline
 */
function cumulativeDistances(coords: [number, number][]): number[] {
  const distances: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const d = haversineDistance(prev[1], prev[0], curr[1], curr[0]);
    distances.push(distances[i - 1] + d);
  }
  return distances;
}

/**
 * Snap user position to the nearest point on a polyline
 * @param userCoord - User's current position
 * @param polylineCoords - Array of [lng, lat] coordinates
 * @returns Snap result with nearest point, segment index, distance, and progress
 */
export function snapToPolyline(
  userCoord: Coord,
  polylineCoords: [number, number][]
): SnapResult | null {
  if (polylineCoords.length < 2) {
    return null;
  }
  
  let minDistance = Infinity;
  let nearestPoint: Coord = { lat: 0, lng: 0 };
  let nearestSegmentIndex = 0;
  let nearestT = 0;
  
  // Find nearest segment
  for (let i = 0; i < polylineCoords.length - 1; i++) {
    const a: Coord = { lat: polylineCoords[i][1], lng: polylineCoords[i][0] };
    const b: Coord = { lat: polylineCoords[i + 1][1], lng: polylineCoords[i + 1][0] };
    
    const result = nearestPointOnSegment(userCoord, a, b);
    const distance = haversineDistance(
      userCoord.lat, userCoord.lng,
      result.point.lat, result.point.lng
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = result.point;
      nearestSegmentIndex = i;
      nearestT = result.t;
    }
  }
  
  // Calculate progress along line
  const cumDist = cumulativeDistances(polylineCoords);
  const segmentLength = haversineDistance(
    polylineCoords[nearestSegmentIndex][1],
    polylineCoords[nearestSegmentIndex][0],
    polylineCoords[nearestSegmentIndex + 1][1],
    polylineCoords[nearestSegmentIndex + 1][0]
  );
  const progressMetersAlongLine = cumDist[nearestSegmentIndex] + nearestT * segmentLength;
  
  return {
    nearestPoint,
    nearestSegmentIndex,
    distanceToLineMeters: minDistance,
    progressMetersAlongLine,
  };
}

/**
 * Split polyline into completed and remaining portions based on progress
 */
export function computeProgressPolyline(
  polylineCoords: [number, number][],
  progressMeters: number
): ProgressPolyline {
  if (polylineCoords.length < 2) {
    return {
      completedCoords: [],
      remainingCoords: polylineCoords,
    };
  }
  
  const cumDist = cumulativeDistances(polylineCoords);
  const totalDistance = cumDist[cumDist.length - 1];
  
  // Clamp progress
  const clampedProgress = Math.max(0, Math.min(totalDistance, progressMeters));
  
  // Find segment where progress falls
  let segmentIndex = 0;
  for (let i = 0; i < cumDist.length - 1; i++) {
    if (cumDist[i + 1] >= clampedProgress) {
      segmentIndex = i;
      break;
    }
    segmentIndex = i;
  }
  
  // Calculate interpolation point
  const segmentStart = cumDist[segmentIndex];
  const segmentEnd = cumDist[segmentIndex + 1] || segmentStart;
  const segmentLength = segmentEnd - segmentStart;
  
  let splitPoint: [number, number];
  if (segmentLength === 0) {
    splitPoint = polylineCoords[segmentIndex];
  } else {
    const t = (clampedProgress - segmentStart) / segmentLength;
    const a = polylineCoords[segmentIndex];
    const b = polylineCoords[segmentIndex + 1];
    splitPoint = [
      a[0] + t * (b[0] - a[0]),
      a[1] + t * (b[1] - a[1]),
    ];
  }
  
  // Build completed coords (up to and including split point)
  const completedCoords: [number, number][] = [
    ...polylineCoords.slice(0, segmentIndex + 1),
    splitPoint,
  ];
  
  // Build remaining coords (from split point to end)
  const remainingCoords: [number, number][] = [
    splitPoint,
    ...polylineCoords.slice(segmentIndex + 1),
  ];
  
  return { completedCoords, remainingCoords };
}

/**
 * Infer marker type from note content
 */
export type MarkerKind = 'danger' | 'mandatory_stop' | 'departure' | 'poi';

export function inferMarkerKind(note: string | null): MarkerKind {
  if (!note) return 'poi';
  const lower = note.toLowerCase();
  
  if (lower.startsWith('danger:') || lower.includes('#danger')) return 'danger';
  if (lower.startsWith('stop:') || lower.includes('#stop')) return 'mandatory_stop';
  if (lower.startsWith('point de départ') || lower.includes('#depart')) return 'departure';
  
  return 'poi';
}

/**
 * Get emoji icon for marker kind
 */
export function getMarkerEmoji(kind: MarkerKind): string {
  switch (kind) {
    case 'danger': return '⚠️';
    case 'mandatory_stop': return '⛔';
    case 'departure': return '🚩';
    case 'poi': return '📍';
  }
}
