/**
 * Interactive Report Generator
 * Generates a self-contained HTML report for route_recon projects
 * with Leaflet map, POI table, distance/time calculations, and exports
 */

import { haversineDistance, inferMarkerKind, getMarkerEmoji, MarkerKind } from '@/lib/routeGeometry';
import type { LineString } from 'geojson';

// ============= Types =============

export interface ReportPOI {
  id: string;
  order: number;
  lat: number;
  lng: number;
  kind: MarkerKind;
  emoji: string;
  note: string | null;
  photoUrl: string | null;
  audioUrl: string | null;
  stopMinutes: number;
  // Phase 2 fields
  name: string;
  functionType: 'passage' | 'pause_the' | 'briefing' | 'repas' | 'visite' | 'arret';
  action: '' | 'enigme' | 'qr_code' | 'photo_requise' | 'defi';
  validationType: '' | 'qr_code' | 'photo' | 'code' | 'manuel' | 'libre';
  risk: 'low' | 'medium' | 'high';
  wifi: 'good' | 'weak' | 'none';
  hints: string;
  notes: string;
}

export interface ReportConfig {
  transportMode: 'walking' | 'scooter' | 'car';
  speedKmh: number;
  playersCount: number;
}

export interface ReportPayload {
  project: {
    name: string;
    city?: string;
    // Quest config data for project sheet
    projectType?: string;
    playMode?: string;
    questType?: string;
    targetAudience?: string[];
    languages?: string[];
    objective?: string;
    storytelling?: {
      enabled: boolean;
      hasAvatar?: boolean;
    };
    decisions?: {
      qrAllowed?: boolean;
      photoAllowed?: boolean;
      staffInvolved?: boolean;
      staffCount?: number;
    };
    stepsCount?: number;
    difficulty?: number;
    durationMin?: number;
  };
  trace: {
    id: string;
    name?: string;
    coordinates: [number, number][]; // [lng, lat]
    totalDistanceM: number;
    startedAt: string | null;
    endedAt: string | null;
  };
  pois: ReportPOI[];
  config: ReportConfig;
  computed: {
    segmentDistancesM: number[];
    travelMinutes: number;
    stopMinutes: number;
    totalMinutes: number;
  };
}

// Route trace and marker types (matching useRouteRecorder)
interface RouteTraceInput {
  id: string;
  name?: string | null;
  geojson: LineString;
  distance_meters: number | null;
  started_at: string | null;
  ended_at: string | null;
}

interface RouteMarkerInput {
  id: string;
  lat: number;
  lng: number;
  note: string | null;
  photo_url: string | null;
  audio_url?: string | null;
  created_at: string;
}

// ============= Helpers =============

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Compute segment distances between consecutive coordinates
 * @param coords Array of [lng, lat] coordinates
 */
export function computeSegmentDistances(coords: [number, number][]): number[] {
  const distances: number[] = [];
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    // haversineDistance expects (lat1, lng1, lat2, lng2)
    const d = haversineDistance(prev[1], prev[0], curr[1], curr[0]);
    distances.push(d);
  }
  return distances;
}

/**
 * Trigger file download in browser
 */
export function downloadTextFile(filename: string, mime: string, content: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Get default speed for transport mode
 */
function getDefaultSpeed(mode: ReportConfig['transportMode']): number {
  switch (mode) {
    case 'walking': return 5;
    case 'scooter': return 15;
    case 'car': return 30;
    default: return 5;
  }
}

// ============= Build Payload =============

// Project input with optional quest_config
interface ProjectInput {
  hotel_name: string;
  city?: string;
  quest_config?: {
    project_type?: string;
    play_mode?: string;
    questType?: string;
    targetAudience?: string | string[];
    languages?: string[];
    core?: {
      objective_business?: string[];
      duration_min?: number;
      difficulty?: number;
    };
    storytelling?: {
      enabled?: boolean;
      narrator?: { avatar_id?: string | null };
    };
    decisions_validated?: {
      qr_allowed?: boolean;
      photo_challenges_allowed?: boolean;
      staff_involved?: boolean;
    };
  };
  pois_count?: number;
}

/**
 * Build the report payload from project, trace, and markers data
 */
export function buildReportPayload(
  project: ProjectInput,
  trace: RouteTraceInput,
  markers: RouteMarkerInput[],
  config?: Partial<ReportConfig>
): ReportPayload {
  // Extract coordinates from geojson
  const coordinates = trace.geojson.coordinates as [number, number][];
  
  // Compute segment distances
  const segmentDistancesM = computeSegmentDistances(coordinates);
  
  // Total distance: use stored value or compute from segments
  const totalDistanceM = trace.distance_meters ?? segmentDistancesM.reduce((a, b) => a + b, 0);
  
  // Sort markers by created_at ascending
  const sortedMarkers = [...markers].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  
  // Build POIs with kind inference and Phase 2 fields
  const pois: ReportPOI[] = sortedMarkers.map((marker, index) => {
    const kind = inferMarkerKind(marker.note);
    return {
      id: marker.id,
      order: index + 1,
      lat: marker.lat,
      lng: marker.lng,
      kind,
      emoji: getMarkerEmoji(kind),
      note: marker.note,
      photoUrl: marker.photo_url,
      audioUrl: marker.audio_url || null,
      stopMinutes: 0,
      // Phase 2 fields with defaults
      name: '',
      functionType: 'passage' as const,
      action: '' as const,
      validationType: '' as const,
      risk: 'low' as const,
      wifi: 'none' as const,
      hints: marker.note || '',
      notes: '',
    };
  });
  
  // Build config with defaults
  const finalConfig: ReportConfig = {
    transportMode: config?.transportMode ?? 'walking',
    speedKmh: config?.speedKmh ?? getDefaultSpeed(config?.transportMode ?? 'walking'),
    playersCount: config?.playersCount ?? 1,
  };
  
  // Compute times
  const travelMinutes = (totalDistanceM / 1000 / finalConfig.speedKmh) * 60;
  const stopMinutes = pois.reduce((sum, poi) => sum + poi.stopMinutes, 0);
  const totalMinutes = travelMinutes + stopMinutes;
  
  // Extract quest config data
  const qc = project.quest_config || {};
  const core = qc.core || {};
  const decisions = qc.decisions_validated || {};
  const storytelling = qc.storytelling || {};
  
  // Normalize target audience to array
  const targetAudience = Array.isArray(qc.targetAudience) 
    ? qc.targetAudience 
    : (qc.targetAudience ? [qc.targetAudience] : []);
  
  return {
    project: {
      name: project.hotel_name,
      city: project.city,
      // Quest config data
      projectType: qc.project_type,
      playMode: qc.play_mode,
      questType: qc.questType,
      targetAudience,
      languages: qc.languages,
      objective: core.objective_business?.[0],
      storytelling: {
        enabled: storytelling.enabled || false,
        hasAvatar: !!(storytelling.narrator?.avatar_id),
      },
      decisions: {
        qrAllowed: decisions.qr_allowed,
        photoAllowed: decisions.photo_challenges_allowed,
        staffInvolved: decisions.staff_involved,
      },
      stepsCount: project.pois_count || pois.length,
      difficulty: core.difficulty,
      durationMin: core.duration_min,
    },
    trace: {
      id: trace.id,
      name: trace.name || undefined,
      coordinates,
      totalDistanceM,
      startedAt: trace.started_at,
      endedAt: trace.ended_at,
    },
    pois,
    config: finalConfig,
    computed: {
      segmentDistancesM,
      travelMinutes,
      stopMinutes,
      totalMinutes,
    },
  };
}

// ============= Generate Interactive HTML =============

/**
 * Generate a self-contained interactive HTML report
 */
export function generateInteractiveReportHTML(
  payload: ReportPayload,
  options?: { autoPrint?: boolean }
): string {
  const autoPrint = options?.autoPrint ?? false;
  
  // Escape all user-provided strings
  const projectName = escapeHtml(payload.project.name);
  const projectCity = escapeHtml(payload.project.city || '');
  
  // Safely encode JSON for script injection
  const safeJson = JSON.stringify(payload).replace(/<\/script>/gi, '<\\/script>');
  
  // Format distance for display
  const formatDistance = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
  
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rapport - ${projectName}</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin="">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #1a1a1a;
      line-height: 1.5;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
    
    /* Header */
    header {
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
      padding: 24px;
      border-radius: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 16px;
    }
    header h1 { font-size: 1.75rem; font-weight: 700; }
    header .city { opacity: 0.8; font-size: 0.9rem; margin-top: 4px; }
    .export-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
    .export-buttons button {
      padding: 8px 16px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 0.85rem;
      font-weight: 500;
      transition: transform 0.1s, opacity 0.1s;
    }
    .export-buttons button:hover { transform: translateY(-1px); opacity: 0.9; }
    .btn-pdf { background: #e74c3c; color: white; }
    .btn-word { background: #3498db; color: white; }
    .btn-html { background: #27ae60; color: white; }
    .btn-json { background: #9b59b6; color: white; }
    
    /* Config Panel */
    .config-panel {
      background: white;
      padding: 16px 20px;
      border-radius: 12px;
      margin-bottom: 20px;
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
      align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .config-group { display: flex; flex-direction: column; gap: 4px; }
    .config-group label { font-size: 0.75rem; color: #666; text-transform: uppercase; font-weight: 600; }
    .config-group select, .config-group input {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.9rem;
      min-width: 120px;
    }
    
    /* Map */
    .map-section {
      background: white;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    #map { height: 400px; width: 100%; }
    .map-fallback {
      height: 400px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: #f0f0f0;
      color: #666;
    }
    .map-fallback-icon { font-size: 3rem; margin-bottom: 12px; }
    
    /* Summary Stats */
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .stat-card.total { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; }
    .stat-label { font-size: 0.75rem; color: inherit; opacity: 0.7; text-transform: uppercase; font-weight: 600; }
    .stat-value { font-size: 1.5rem; font-weight: 700; margin-top: 4px; }
    
    /* POI Table - Redesigned */
    .pois-section {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      overflow: hidden;
      margin-bottom: 20px;
    }
    .pois-header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .pois-header h2 {
      font-size: 1.1rem;
      font-weight: 700;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pois-count {
      background: rgba(255,255,255,0.2);
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 700;
    }
    .pois-body {
      padding: 20px;
      overflow-x: auto;
    }
    table { width: 100%; border-collapse: collapse; min-width: 1200px; }
    th, td { padding: 10px 8px; text-align: left; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
    th { 
      font-size: 0.7rem; 
      text-transform: uppercase; 
      color: #10b981; 
      font-weight: 700; 
      white-space: nowrap;
      letter-spacing: 0.3px;
      background: #f0fdf4;
    }
    td { font-size: 0.85rem; }
    tbody tr:hover { background: #f9fafb; }
    .poi-input, .poi-select, .poi-textarea {
      padding: 6px 8px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      font-size: 0.85rem;
      width: 100%;
      box-sizing: border-box;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .poi-input:focus, .poi-select:focus, .poi-textarea:focus {
      outline: none;
      border-color: #10b981;
      box-shadow: 0 0 0 3px rgba(16,185,129,0.15);
    }
    .poi-input.name { min-width: 90px; }
    .poi-input.stop { width: 55px; text-align: center; font-weight: 600; }
    .poi-input.gps { width: 105px; background: #f8f9fa; color: #6b7280; font-size: 0.75rem; font-family: 'SF Mono', Monaco, monospace; }
    .poi-select { min-width: 75px; }
    .poi-textarea { min-height: 45px; resize: vertical; font-family: inherit; }
    .poi-photo-thumb { 
      width: 48px;
      height: 48px;
      object-fit: cover;
      border-radius: 6px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      border: 1px solid #e5e7eb;
    }
    .poi-photo-thumb:hover { transform: scale(1.1); box-shadow: 0 4px 12px rgba(0,0,0,0.2); }
    
    /* Photo Gallery */
    .photo-gallery { 
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      overflow: hidden;
      margin-bottom: 20px;
    }
    .photo-gallery-header {
      background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
      color: white;
      padding: 14px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .photo-gallery-header h2 {
      font-size: 1.1rem;
      font-weight: 700;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .photo-gallery-body { padding: 20px; }
    .photo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
    }
    .photo-card {
      position: relative;
      aspect-ratio: 1;
      border-radius: 10px;
      overflow: hidden;
      cursor: pointer;
      border: 1px solid #e5e7eb;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    .photo-card:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0,0,0,0.15); }
    .photo-card img { width: 100%; height: 100%; object-fit: cover; }
    .photo-card-overlay {
      position: absolute;
      inset: 0;
      background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 50%);
      display: flex;
      flex-direction: column;
      justify-content: flex-end;
      padding: 8px;
    }
    .photo-card-gps { font-size: 0.65rem; color: rgba(255,255,255,0.7); font-family: 'SF Mono', Monaco, monospace; }
    .photo-card-note { font-size: 0.75rem; color: white; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    
    /* Lightbox */
    .report-lightbox {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: rgba(0,0,0,0.95);
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }
    .report-lightbox.active { display: flex; }
    .report-lightbox-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      font-size: 1.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .report-lightbox-close:hover { background: rgba(255,255,255,0.3); }
    .report-lightbox-download {
      position: absolute;
      top: 16px;
      right: 68px;
      background: rgba(255,255,255,0.2);
      border: none;
      color: white;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      font-size: 1.2rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      text-decoration: none;
    }
    .report-lightbox-download:hover { background: rgba(255,255,255,0.3); }
    .report-lightbox img { max-width: 90vw; max-height: 80vh; object-fit: contain; border-radius: 8px; }
    .report-lightbox-info { color: white; text-align: center; margin-top: 12px; font-size: 0.85rem; }
    .report-lightbox-gps { color: rgba(255,255,255,0.6); font-size: 0.75rem; margin-top: 4px; }
    .empty-state { padding: 40px; text-align: center; color: #999; }
    
    /* Meta bar - Redesigned */
    .meta-bar { 
      background: white;
      border-radius: 16px;
      margin-bottom: 20px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .meta-bar-header {
      background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
      color: white;
      padding: 14px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .meta-bar-header h3 {
      font-size: 1rem;
      font-weight: 700;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .meta-bar-header .meta-distance {
      background: rgba(255,255,255,0.2);
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 700;
    }
    .meta-bar-body { padding: 20px 24px; }
    .meta-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .meta-card { 
      background: #f8f9fa;
      border: 1px solid #e5e7eb;
      border-radius: 12px; 
      padding: 16px;
    }
    .meta-title { 
      font-size: 0.7rem; 
      text-transform: uppercase; 
      font-weight: 700; 
      color: #0891b2; 
      margin-bottom: 12px; 
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .meta-row { 
      display: flex; 
      justify-content: space-between; 
      align-items: center; 
      font-size: 0.85rem; 
      padding: 6px 0; 
      border-bottom: 1px solid #e5e7eb;
    }
    .meta-row:last-child { border-bottom: none; }
    .meta-row span { color: #6b7280; font-weight: 500; }
    .meta-row strong { color: #1f2937; font-weight: 600; }
    .meta-row code { 
      font-family: 'SF Mono', Monaco, monospace; 
      font-size: 0.75rem; 
      background: #e5e7eb; 
      padding: 3px 8px; 
      border-radius: 4px; 
      color: #4b5563;
    }
    
    
    /* Project Sheet - Redesigned */
    .project-sheet { 
      background: white;
      border-radius: 16px; 
      padding: 0; 
      margin-bottom: 20px;
      box-shadow: 0 4px 16px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .project-sheet-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 16px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .project-sheet-header h2 {
      font-size: 1.1rem;
      font-weight: 700;
      margin: 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .project-sheet-total {
      background: rgba(255,255,255,0.2);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 1.2rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .project-sheet-total span { font-size: 0.75rem; opacity: 0.9; font-weight: 500; }
    .project-sheet-body { padding: 20px 24px; }
    .sheet-section { margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #eee; }
    .sheet-section:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
    .sheet-section-title {
      font-size: 0.7rem;
      text-transform: uppercase;
      font-weight: 700;
      color: #667eea;
      margin-bottom: 12px;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .sheet-grid { 
      display: grid; 
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); 
      gap: 10px 20px; 
    }
    .sheet-field { 
      display: flex; 
      flex-direction: column;
      gap: 4px;
    }
    .sheet-field-label { 
      font-size: 0.7rem; 
      color: #888; 
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .sheet-field-value { 
      font-size: 0.9rem;
      color: #333; 
      font-weight: 600;
      padding: 8px 12px;
      background: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #e5e5e5;
      min-height: 38px;
      display: flex;
      align-items: center;
    }
    .sheet-field-value.editable {
      background: white;
      cursor: text;
    }
    .sheet-field-value.yes { color: #22c55e; background: #22c55e10; border-color: #22c55e40; }
    .sheet-field-value.no { color: #94a3b8; background: #f8f9fa; }
    .sheet-input, .sheet-select {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 500;
      background: white;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    .sheet-input:focus, .sheet-select:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102,126,234,0.15);
    }
    .sheet-checkbox-group { display: flex; flex-wrap: wrap; gap: 8px; }
    .sheet-checkbox {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      background: #f8f9fa;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      font-size: 0.8rem;
      cursor: pointer;
      transition: all 0.2s;
    }
    .sheet-checkbox:hover { border-color: #667eea; }
    .sheet-checkbox.active { background: #667eea15; border-color: #667eea; color: #667eea; font-weight: 600; }
    .sheet-checkbox input { display: none; }
    .sheet-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      background: #667eea20;
      color: #667eea;
    }
    .sheet-toggle {
      position: relative;
      width: 44px;
      height: 24px;
      background: #e5e5e5;
      border-radius: 12px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .sheet-toggle.active { background: #22c55e; }
    .sheet-toggle::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      transition: transform 0.2s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
    }
    .sheet-toggle.active::after { transform: translateX(20px); }
    .sheet-inline { display: flex; align-items: center; gap: 8px; }
    .sheet-number {
      width: 60px;
      text-align: center;
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .sheet-number:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102,126,234,0.15);
    }
    .sheet-suffix { font-size: 0.8rem; color: #666; }
    
    /* Print styles */
    @media print {
      body { background: white; }
      .container { padding: 0; max-width: none; }
      header { background: #1a1a2e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .export-buttons, .config-panel { display: none !important; }
      /* Meta bar print */
      .meta-bar { margin-bottom: 10px; box-shadow: none; }
      .meta-bar-header { background: #0891b2 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 10px 16px; }
      .meta-bar-body { padding: 12px 16px; }
      /* Project sheet print */
      .project-sheet { box-shadow: none; }
      .project-sheet-header { background: #667eea !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 10px 16px; }
      .project-sheet-body { padding: 12px 16px; }
      /* Inputs print */
      .sheet-input, .sheet-select, .sheet-number { border: none; background: transparent; padding: 0; }
      /* Map */
      .map-section { break-inside: avoid; }
      #map { height: 300px; }
      /* POI table print */
      .pois-section { break-inside: avoid; box-shadow: none; }
      .pois-header { background: #059669 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 10px 16px; }
      .pois-body { padding: 12px 16px; overflow: visible; }
      table { font-size: 0.65rem; min-width: auto; }
      th, td { padding: 4px 3px; }
      th { background: #ecfdf5 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .poi-input, .poi-select, .poi-textarea { border: none; padding: 0; font-size: 0.65rem; background: transparent; }
      .poi-textarea { min-height: auto; }
    }
    
    @media (max-width: 768px) {
      header { flex-direction: column; }
      .config-panel { flex-direction: column; gap: 12px; }
      .config-group { width: 100%; }
      .config-group select, .config-group input { width: 100%; }
      /* Meta bar mobile */
      .meta-bar-header { flex-direction: column; gap: 10px; padding: 14px 16px; }
      .meta-bar-body { padding: 14px 16px; }
      .sheet-grid { grid-template-columns: 1fr 1fr; }
      /* POI section mobile */
      .pois-header { flex-direction: column; gap: 10px; padding: 14px 16px; }
      .pois-body { padding: 12px; }
      /* Map */
      #map { height: 300px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1>${projectName}</h1>
        ${projectCity ? `<p class="city">📍 ${projectCity}</p>` : ''}
      </div>
      <div class="export-buttons no-print">
        <button class="btn-pdf" onclick="window.print()">🖨️ PDF</button>
        <button class="btn-json" onclick="exportJSON()">📄 JSON</button>
        <button class="btn-word" onclick="exportWord()">📝 Word</button>
      </div>
    </header>
    
    <div class="config-panel no-print">
      <div class="config-group">
        <label>Mode de transport</label>
        <select id="transport" onchange="updateSpeed(); recalculate();">
          <option value="walking" ${payload.config.transportMode === 'walking' ? 'selected' : ''}>🚶 Marche</option>
          <option value="scooter" ${payload.config.transportMode === 'scooter' ? 'selected' : ''}>🛵 Scooter</option>
          <option value="car" ${payload.config.transportMode === 'car' ? 'selected' : ''}>🚗 Voiture</option>
        </select>
      </div>
      <div class="config-group">
        <label>Vitesse (km/h)</label>
        <input type="number" id="speed" value="${payload.config.speedKmh}" min="1" max="120" onchange="recalculate();">
      </div>
      <div class="config-group">
        <label>Joueurs</label>
        <input type="number" id="players" value="${payload.config.playersCount}" min="1" max="100">
      </div>
    </div>
    
    <section class="project-sheet">
      <div class="project-sheet-header">
        <h2>📋 Fiche Projet</h2>
        <div class="project-sheet-total">
          <span>TEMPS TOTAL</span>
          <span id="sheet-total-time">${Math.round(payload.computed.totalMinutes)} min</span>
        </div>
      </div>
      <div class="project-sheet-body">
        <!-- Section 1: Identité -->
        <div class="sheet-section">
          <div class="sheet-section-title">🎯 Identité du Projet</div>
          <div class="sheet-grid">
            <div class="sheet-field">
              <span class="sheet-field-label">Nom du projet</span>
              <input type="text" class="sheet-input" id="sheet-project-name" data-sheet-field="projectName" value="${escapeHtml(projectName)}">
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">Type de projet</span>
              <select class="sheet-select" id="sheet-project-type" data-sheet-field="projectType">
                <option value="" ${!payload.project.projectType ? 'selected' : ''}>—</option>
                <option value="establishment" ${payload.project.projectType === 'establishment' ? 'selected' : ''}>Établissement</option>
                <option value="tourist_spot" ${payload.project.projectType === 'tourist_spot' ? 'selected' : ''}>Site Touristique</option>
                <option value="route_recon" ${payload.project.projectType === 'route_recon' ? 'selected' : ''}>Reconnaissance Parcours</option>
              </select>
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">Mode de jeu</span>
              <select class="sheet-select" id="sheet-play-mode" data-sheet-field="playMode">
                <option value="" ${!payload.project.playMode ? 'selected' : ''}>—</option>
                <option value="solo" ${payload.project.playMode === 'solo' ? 'selected' : ''}>Solo</option>
                <option value="team" ${payload.project.playMode === 'team' ? 'selected' : ''}>Équipes</option>
                <option value="one_vs_one" ${payload.project.playMode === 'one_vs_one' ? 'selected' : ''}>1 vs 1</option>
                <option value="multi_solo" ${payload.project.playMode === 'multi_solo' ? 'selected' : ''}>Multi-joueurs</option>
              </select>
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">Type de quête</span>
              <select class="sheet-select" id="sheet-quest-type" data-sheet-field="questType">
                <option value="" ${!payload.project.questType ? 'selected' : ''}>—</option>
                <option value="exploration" ${payload.project.questType === 'exploration' ? 'selected' : ''}>Exploration</option>
                <option value="sequential" ${payload.project.questType === 'sequential' ? 'selected' : ''}>Séquentiel</option>
                <option value="timed_race" ${payload.project.questType === 'timed_race' ? 'selected' : ''}>Course chronométrée</option>
                <option value="collaborative" ${payload.project.questType === 'collaborative' ? 'selected' : ''}>Collaboratif</option>
                <option value="team_competition" ${payload.project.questType === 'team_competition' ? 'selected' : ''}>Compétition équipes</option>
              </select>
            </div>
          </div>
        </div>
        
        <!-- Section 2: Audience & Langues -->
        <div class="sheet-section">
          <div class="sheet-section-title">👥 Public & Langues</div>
          <div class="sheet-grid">
            <div class="sheet-field" style="grid-column: span 2;">
              <span class="sheet-field-label">Public cible</span>
              <div class="sheet-checkbox-group" id="sheet-audience-group">
                <label class="sheet-checkbox ${(payload.project.targetAudience || []).includes('family') ? 'active' : ''}" data-value="family">
                  <input type="checkbox" ${(payload.project.targetAudience || []).includes('family') ? 'checked' : ''}> 👨‍👩‍👧 Famille
                </label>
                <label class="sheet-checkbox ${(payload.project.targetAudience || []).includes('couples') ? 'active' : ''}" data-value="couples">
                  <input type="checkbox" ${(payload.project.targetAudience || []).includes('couples') ? 'checked' : ''}> 💑 Couples
                </label>
                <label class="sheet-checkbox ${(payload.project.targetAudience || []).includes('friends') ? 'active' : ''}" data-value="friends">
                  <input type="checkbox" ${(payload.project.targetAudience || []).includes('friends') ? 'checked' : ''}> 👯 Amis
                </label>
                <label class="sheet-checkbox ${(payload.project.targetAudience || []).includes('corporate') ? 'active' : ''}" data-value="corporate">
                  <input type="checkbox" ${(payload.project.targetAudience || []).includes('corporate') ? 'checked' : ''}> 💼 Corporate
                </label>
                <label class="sheet-checkbox ${(payload.project.targetAudience || []).includes('teens') ? 'active' : ''}" data-value="teens">
                  <input type="checkbox" ${(payload.project.targetAudience || []).includes('teens') ? 'checked' : ''}> 🎮 Ados
                </label>
                <label class="sheet-checkbox ${(payload.project.targetAudience || []).includes('kids') ? 'active' : ''}" data-value="kids">
                  <input type="checkbox" ${(payload.project.targetAudience || []).includes('kids') ? 'checked' : ''}> 🧒 Enfants
                </label>
                <label class="sheet-checkbox ${(payload.project.targetAudience || []).includes('seniors') ? 'active' : ''}" data-value="seniors">
                  <input type="checkbox" ${(payload.project.targetAudience || []).includes('seniors') ? 'checked' : ''}> 👴 Seniors
                </label>
              </div>
            </div>
            <div class="sheet-field" style="grid-column: span 2;">
              <span class="sheet-field-label">Langues disponibles</span>
              <div class="sheet-checkbox-group" id="sheet-languages-group">
                <label class="sheet-checkbox ${(payload.project.languages || []).includes('fr') ? 'active' : ''}" data-value="fr">
                  <input type="checkbox" ${(payload.project.languages || []).includes('fr') ? 'checked' : ''}> 🇫🇷 Français
                </label>
                <label class="sheet-checkbox ${(payload.project.languages || []).includes('en') ? 'active' : ''}" data-value="en">
                  <input type="checkbox" ${(payload.project.languages || []).includes('en') ? 'checked' : ''}> 🇬🇧 Anglais
                </label>
                <label class="sheet-checkbox ${(payload.project.languages || []).includes('ar') ? 'active' : ''}" data-value="ar">
                  <input type="checkbox" ${(payload.project.languages || []).includes('ar') ? 'checked' : ''}> 🇸🇦 Arabe
                </label>
                <label class="sheet-checkbox ${(payload.project.languages || []).includes('es') ? 'active' : ''}" data-value="es">
                  <input type="checkbox" ${(payload.project.languages || []).includes('es') ? 'checked' : ''}> 🇪🇸 Espagnol
                </label>
                <label class="sheet-checkbox ${(payload.project.languages || []).includes('ary') ? 'active' : ''}" data-value="ary">
                  <input type="checkbox" ${(payload.project.languages || []).includes('ary') ? 'checked' : ''}> 🇲🇦 Darija
                </label>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Section 3: Paramètres -->
        <div class="sheet-section">
          <div class="sheet-section-title">⚙️ Paramètres du Jeu</div>
          <div class="sheet-grid">
            <div class="sheet-field">
              <span class="sheet-field-label">Objectif principal</span>
              <input type="text" class="sheet-input" id="sheet-objective" data-sheet-field="objective" value="${escapeHtml(payload.project.objective || '')}">
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">Nombre d'étapes</span>
              <div class="sheet-inline">
                <input type="number" class="sheet-number" id="sheet-steps" data-sheet-field="stepsCount" value="${payload.project.stepsCount || payload.pois.length}" min="1" max="50">
                <span class="sheet-suffix">étapes</span>
              </div>
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">Difficulté estimée</span>
              <div class="sheet-inline">
                <input type="number" class="sheet-number" id="sheet-difficulty" data-sheet-field="difficulty" value="${payload.project.difficulty || 3}" min="1" max="5">
                <span class="sheet-suffix">/ 5</span>
              </div>
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">Durée estimée</span>
              <div class="sheet-inline">
                <input type="number" class="sheet-number" id="sheet-duration" data-sheet-field="durationMin" value="${payload.project.durationMin || Math.round(payload.computed.totalMinutes)}" min="1" max="300">
                <span class="sheet-suffix">min</span>
              </div>
            </div>
          </div>
        </div>
        
        <!-- Section 4: Options & Validations -->
        <div class="sheet-section">
          <div class="sheet-section-title">✅ Options & Validations</div>
          <div class="sheet-grid">
            <div class="sheet-field">
              <span class="sheet-field-label">QR autorisé</span>
              <div class="sheet-inline">
                <div class="sheet-toggle ${payload.project.decisions?.qrAllowed ? 'active' : ''}" id="sheet-qr" data-sheet-toggle="qrAllowed"></div>
                <span id="sheet-qr-label">${payload.project.decisions?.qrAllowed ? 'Oui' : 'Non'}</span>
              </div>
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">Validation photo</span>
              <div class="sheet-inline">
                <div class="sheet-toggle ${payload.project.decisions?.photoAllowed ? 'active' : ''}" id="sheet-photo" data-sheet-toggle="photoAllowed"></div>
                <span id="sheet-photo-label">${payload.project.decisions?.photoAllowed ? 'Oui' : 'Non'}</span>
              </div>
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">Staff impliqué</span>
              <div class="sheet-inline">
                <div class="sheet-toggle ${payload.project.decisions?.staffInvolved ? 'active' : ''}" id="sheet-staff" data-sheet-toggle="staffInvolved"></div>
                <span id="sheet-staff-label">${payload.project.decisions?.staffInvolved ? 'Oui' : 'Non'}</span>
              </div>
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">Storytelling</span>
              <div class="sheet-inline">
                <div class="sheet-toggle ${payload.project.storytelling?.enabled ? 'active' : ''}" id="sheet-storytelling" data-sheet-toggle="storytellingEnabled"></div>
                <span id="sheet-storytelling-label">${payload.project.storytelling?.enabled ? (payload.project.storytelling.hasAvatar ? 'Avec avatar' : 'Activé') : 'Non'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    
    <section id="meta-bar" class="meta-bar">
      <div class="meta-bar-header">
        <h3>📍 Infos Parcours</h3>
        <div class="meta-distance" id="meta-distance">${formatDistance(payload.trace.totalDistanceM)}</div>
      </div>
      <div class="meta-bar-body">
        <!-- Section 1: Trace -->
        <div class="sheet-section">
          <div class="meta-title">🗺️ Trace</div>
          <div class="sheet-grid">
            <div class="sheet-field">
              <span class="sheet-field-label">Nom de la trace</span>
              <input type="text" class="sheet-input" id="meta-trace-name-input" data-meta-field="traceName" value="${escapeHtml(payload.trace.name || 'Trace')}">
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">ID Trace</span>
              <div class="sheet-field-value" style="font-family: 'SF Mono', Monaco, monospace; font-size: 0.75rem;">${escapeHtml(payload.trace.id.slice(0, 8))}</div>
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">Points GPS</span>
              <div class="sheet-field-value">${payload.trace.coordinates.length}</div>
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">Marqueurs</span>
              <div class="sheet-field-value" id="meta-markers-display">${payload.pois.length}</div>
            </div>
          </div>
        </div>
        
        <!-- Section 2: Timing -->
        <div class="sheet-section">
          <div class="meta-title">⏱️ Timing</div>
          <div class="sheet-grid">
            <div class="sheet-field">
              <span class="sheet-field-label">Date début</span>
              <input type="text" class="sheet-input" id="meta-start-input" data-meta-field="startDate" value="${payload.trace.startedAt ? new Date(payload.trace.startedAt).toLocaleString('fr-FR') : '—'}">
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">Date fin</span>
              <input type="text" class="sheet-input" id="meta-end-input" data-meta-field="endDate" value="${payload.trace.endedAt ? new Date(payload.trace.endedAt).toLocaleString('fr-FR') : '—'}">
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">Temps trajet</span>
              <div class="sheet-field-value" id="meta-travel">${Math.round(payload.computed.travelMinutes)} min</div>
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">Temps arrêts</span>
              <div class="sheet-field-value" id="meta-stops">${payload.computed.stopMinutes} min</div>
            </div>
          </div>
        </div>
        
        <!-- Section 3: Configuration -->
        <div class="sheet-section" style="margin-bottom: 0; padding-bottom: 0; border-bottom: none;">
          <div class="meta-title">⚙️ Configuration</div>
          <div class="sheet-grid">
            <div class="sheet-field">
              <span class="sheet-field-label">Mode de transport</span>
              <select class="sheet-select" id="meta-transport-select" data-meta-field="transportMode">
                <option value="walking" ${payload.config.transportMode === 'walking' ? 'selected' : ''}>🚶 Marche</option>
                <option value="scooter" ${payload.config.transportMode === 'scooter' ? 'selected' : ''}>🛵 Scooter</option>
                <option value="car" ${payload.config.transportMode === 'car' ? 'selected' : ''}>🚗 Voiture</option>
              </select>
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">Vitesse (km/h)</span>
              <input type="number" class="sheet-number" style="width: 100%;" id="meta-speed-input" data-meta-field="speedKmh" value="${payload.config.speedKmh}" min="1" max="120">
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">Nombre de joueurs</span>
              <input type="number" class="sheet-number" style="width: 100%;" id="meta-players-input" data-meta-field="playersCount" value="${payload.config.playersCount}" min="1" max="100">
            </div>
            <div class="sheet-field">
              <span class="sheet-field-label">Notes parcours</span>
              <input type="text" class="sheet-input" id="meta-notes-input" data-meta-field="routeNotes" value="" placeholder="Observations...">
            </div>
          </div>
        </div>
      </div>
    </section>
    
    <div class="map-section">
      <div id="map"></div>
      <div id="map-fallback" style="display:none;">
        <div class="map-fallback-icon">🗺️</div>
        <p><strong>Carte non disponible</strong></p>
        <p>Le service de cartographie n'a pas pu être chargé.</p>
        <p style="margin-top:12px;">Distance totale: <strong>${formatDistance(payload.trace.totalDistanceM)}</strong> | ${payload.trace.coordinates.length} points</p>
      </div>
    </div>
    
    
    
    <section class="pois-section">
      <div class="pois-header">
        <h2>📍 Points d'intérêt</h2>
        <div class="pois-count" id="pois-count">${payload.pois.length} POI${payload.pois.length > 1 ? 's' : ''}</div>
      </div>
      <div class="pois-body">
      ${payload.pois.length === 0 ? `
        <div class="empty-state">
          <p>Aucun marqueur sur ce parcours</p>
        </div>
      ` : `
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Nom</th>
              <th>Type</th>
              <th>Action</th>
              <th>Validation</th>
              <th>Durée</th>
              <th>Risque</th>
              <th>Wi-Fi</th>
              <th>GPS</th>
              <th>Indice(s)</th>
              <th>Photo</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            ${payload.pois.map((poi) => `
              <tr data-poi-id="${escapeHtml(poi.id)}">
                <td>${poi.order}</td>
                <td>
                  <input type="text" class="poi-input name" data-poi-id="${escapeHtml(poi.id)}" data-field="name" value="${escapeHtml(poi.name)}" placeholder="POI #${poi.order}">
                </td>
                <td>
                  <select class="poi-select" data-poi-id="${escapeHtml(poi.id)}" data-field="functionType">
                    <option value="passage" ${poi.functionType === 'passage' ? 'selected' : ''}>Passage</option>
                    <option value="pause_the" ${poi.functionType === 'pause_the' ? 'selected' : ''}>Pause thé</option>
                    <option value="briefing" ${poi.functionType === 'briefing' ? 'selected' : ''}>Briefing</option>
                    <option value="repas" ${poi.functionType === 'repas' ? 'selected' : ''}>Repas</option>
                    <option value="visite" ${poi.functionType === 'visite' ? 'selected' : ''}>Visite</option>
                    <option value="arret" ${poi.functionType === 'arret' ? 'selected' : ''}>Arrêt</option>
                  </select>
                </td>
                <td>
                  <select class="poi-select" data-poi-id="${escapeHtml(poi.id)}" data-field="action">
                    <option value="" ${poi.action === '' ? 'selected' : ''}>—</option>
                    <option value="enigme" ${poi.action === 'enigme' ? 'selected' : ''}>Énigme</option>
                    <option value="qr_code" ${poi.action === 'qr_code' ? 'selected' : ''}>QR Code</option>
                    <option value="photo_requise" ${poi.action === 'photo_requise' ? 'selected' : ''}>Photo</option>
                    <option value="defi" ${poi.action === 'defi' ? 'selected' : ''}>Défi</option>
                  </select>
                </td>
                <td>
                  <select class="poi-select" data-poi-id="${escapeHtml(poi.id)}" data-field="validationType">
                    <option value="" ${poi.validationType === '' ? 'selected' : ''}>—</option>
                    <option value="qr_code" ${poi.validationType === 'qr_code' ? 'selected' : ''}>QR Code</option>
                    <option value="photo" ${poi.validationType === 'photo' ? 'selected' : ''}>Photo</option>
                    <option value="code" ${poi.validationType === 'code' ? 'selected' : ''}>Code</option>
                    <option value="manuel" ${poi.validationType === 'manuel' ? 'selected' : ''}>Manuel</option>
                    <option value="libre" ${poi.validationType === 'libre' ? 'selected' : ''}>Libre</option>
                  </select>
                </td>
                <td>
                  <input type="number" class="poi-input stop" data-poi-id="${escapeHtml(poi.id)}" data-field="stopMinutes" value="${poi.stopMinutes}" min="0" max="120">
                </td>
                <td>
                  <select class="poi-select" data-poi-id="${escapeHtml(poi.id)}" data-field="risk">
                    <option value="low" ${poi.risk === 'low' ? 'selected' : ''}>Faible</option>
                    <option value="medium" ${poi.risk === 'medium' ? 'selected' : ''}>Moyen</option>
                    <option value="high" ${poi.risk === 'high' ? 'selected' : ''}>Élevé</option>
                  </select>
                </td>
                <td>
                  <select class="poi-select" data-poi-id="${escapeHtml(poi.id)}" data-field="wifi">
                    <option value="none" ${poi.wifi === 'none' ? 'selected' : ''}>Aucun</option>
                    <option value="weak" ${poi.wifi === 'weak' ? 'selected' : ''}>Faible</option>
                    <option value="good" ${poi.wifi === 'good' ? 'selected' : ''}>Bon</option>
                  </select>
                </td>
                <td>
                  <input type="text" class="poi-input gps" data-poi-id="${escapeHtml(poi.id)}" data-field="gps" value="${poi.lat.toFixed(5)}, ${poi.lng.toFixed(5)}" readonly>
                </td>
                <td>
                  <textarea class="poi-textarea" data-poi-id="${escapeHtml(poi.id)}" data-field="hints" rows="2">${escapeHtml(poi.hints)}</textarea>
                </td>
                <td>
                  ${poi.photoUrl ? `<img src="${escapeHtml(poi.photoUrl)}" alt="Photo POI ${poi.order}" class="poi-photo-thumb" onclick="openReportLightbox('${escapeHtml(poi.photoUrl)}', '${escapeHtml(poi.note || '')}', '${poi.lat.toFixed(5)}, ${poi.lng.toFixed(5)}')" />` : ''}
                  ${poi.audioUrl ? `<audio controls style="width:120px;height:28px;margin-top:4px;display:block;"><source src="${escapeHtml(poi.audioUrl)}" type="audio/webm" /></audio>` : ''}
                  ${!poi.photoUrl && !poi.audioUrl ? '—' : ''}
                </td>
                <td>
                  <textarea class="poi-textarea" data-poi-id="${escapeHtml(poi.id)}" data-field="notes" rows="2">${escapeHtml(poi.notes)}</textarea>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
      </div>
    </section>

    <!-- Photo Gallery Section -->
    ${(() => {
      const photoPois = payload.pois.filter(p => p.photoUrl);
      if (photoPois.length === 0) return '';
      return `
    <section class="photo-gallery">
      <div class="photo-gallery-header">
        <h2>📸 Galerie Photos</h2>
        <span style="background:rgba(255,255,255,0.2);padding:6px 14px;border-radius:8px;font-weight:700;">${photoPois.length} photo(s)</span>
      </div>
      <div class="photo-gallery-body">
        <div class="photo-grid">
          ${photoPois.map(poi => `
            <div class="photo-card" onclick="openReportLightbox('${escapeHtml(poi.photoUrl!)}', '${escapeHtml(poi.note || '')}', '${poi.lat.toFixed(5)}, ${poi.lng.toFixed(5)}')">
              <img src="${escapeHtml(poi.photoUrl!)}" alt="Photo POI ${poi.order}" loading="lazy" />
              <div class="photo-card-overlay">
                <span class="photo-card-gps">📍 ${poi.lat.toFixed(5)}, ${poi.lng.toFixed(5)}</span>
                ${poi.note ? `<span class="photo-card-note">${escapeHtml(poi.note)}</span>` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </section>`;
    })()}
  </div>

  <!-- Lightbox overlay -->
  <div class="report-lightbox" id="reportLightbox">
    <a class="report-lightbox-download" id="lightboxDownload" href="#" download title="Télécharger">⬇</a>
    <button class="report-lightbox-close" onclick="closeReportLightbox()">✕</button>
    <img id="lightboxImg" src="" alt="Photo" />
    <div class="report-lightbox-info" id="lightboxNote"></div>
    <div class="report-lightbox-gps" id="lightboxGps"></div>
  </div>
  
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script>
    // Lightbox functions
    function openReportLightbox(url, note, gps) {
      const lb = document.getElementById('reportLightbox');
      document.getElementById('lightboxImg').src = url;
      document.getElementById('lightboxNote').textContent = note || '';
      document.getElementById('lightboxGps').textContent = gps ? '📍 ' + gps : '';
      document.getElementById('lightboxDownload').href = url;
      lb.classList.add('active');
      document.body.style.overflow = 'hidden';
      lb.onclick = function(e) { if (e.target === lb) closeReportLightbox(); };
    }
    function closeReportLightbox() {
      document.getElementById('reportLightbox').classList.remove('active');
      document.body.style.overflow = '';
    }
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeReportLightbox(); });
  </script>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
  <script>
    // Safely injected data
    const REPORT_DATA = ${safeJson};
    const AUTO_PRINT = ${autoPrint};
    const STORAGE_KEY = 'interactive_report:' + REPORT_DATA.trace.id;
    
    // Speed defaults per mode
    const SPEED_DEFAULTS = { walking: 5, scooter: 15, car: 30 };
    
    // Internal state (mutable, persisted to localStorage)
    const STATE = {
      config: {
        transportMode: REPORT_DATA.config.transportMode,
        speedKmh: REPORT_DATA.config.speedKmh,
        playersCount: REPORT_DATA.config.playersCount
      },
      pois: REPORT_DATA.pois.map(p => ({
        id: p.id,
        order: p.order,
        lat: p.lat,
        lng: p.lng,
        name: p.name || '',
        functionType: p.functionType || 'passage',
        action: p.action || '',
        validationType: p.validationType || '',
        stopMinutes: p.stopMinutes || 0,
        risk: p.risk || 'low',
        wifi: p.wifi || 'none',
        hints: p.hints || '',
        notes: p.notes || '',
        photoUrl: p.photoUrl || null
      })),
      computed: {
        totalDistanceM: REPORT_DATA.trace.totalDistanceM,
        travelMinutes: REPORT_DATA.computed.travelMinutes,
        stopMinutes: REPORT_DATA.computed.stopMinutes,
        totalMinutes: REPORT_DATA.computed.totalMinutes
      },
      // Project sheet state
      project: {
        projectName: REPORT_DATA.project.name || '',
        projectType: REPORT_DATA.project.projectType || '',
        playMode: REPORT_DATA.project.playMode || '',
        questType: REPORT_DATA.project.questType || '',
        targetAudience: REPORT_DATA.project.targetAudience || [],
        languages: REPORT_DATA.project.languages || [],
        objective: REPORT_DATA.project.objective || '',
        stepsCount: REPORT_DATA.project.stepsCount || REPORT_DATA.pois.length,
        difficulty: REPORT_DATA.project.difficulty || 3,
        durationMin: REPORT_DATA.project.durationMin || Math.round(REPORT_DATA.computed.totalMinutes),
        qrAllowed: REPORT_DATA.project.decisions?.qrAllowed || false,
        photoAllowed: REPORT_DATA.project.decisions?.photoAllowed || false,
        staffInvolved: REPORT_DATA.project.decisions?.staffInvolved || false,
        storytellingEnabled: REPORT_DATA.project.storytelling?.enabled || false
      },
      // Meta bar state (editable fields)
      meta: {
        traceName: REPORT_DATA.trace.name || 'Trace',
        startDate: REPORT_DATA.trace.startedAt ? new Date(REPORT_DATA.trace.startedAt).toLocaleString('fr-FR') : '—',
        endDate: REPORT_DATA.trace.endedAt ? new Date(REPORT_DATA.trace.endedAt).toLocaleString('fr-FR') : '—',
        routeNotes: ''
      }
    };
    
    // Load from localStorage
    function loadState() {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return;
        const parsed = JSON.parse(saved);
        // Merge config
        if (parsed.config) {
          Object.assign(STATE.config, parsed.config);
        }
        // Merge POIs by id
        if (parsed.pois && Array.isArray(parsed.pois)) {
          const savedMap = {};
          parsed.pois.forEach(p => { savedMap[p.id] = p; });
          STATE.pois.forEach((poi, idx) => {
            if (savedMap[poi.id]) {
              Object.assign(STATE.pois[idx], savedMap[poi.id]);
            }
          });
        }
        // Merge project sheet state
        if (parsed.project) {
          Object.assign(STATE.project, parsed.project);
        }
        // Merge meta bar state
        if (parsed.meta) {
          Object.assign(STATE.meta, parsed.meta);
        }
      } catch (e) {
        console.warn('Failed to load state:', e);
      }
    }
    
    // Save to localStorage
    function saveState() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(STATE));
      } catch (e) {
        console.warn('Failed to save state:', e);
      }
    }
    
    // Apply state to DOM - fix: handle 0 values properly
    function applyStateToDOM() {
      // Config
      document.getElementById('transport').value = STATE.config.transportMode;
      document.getElementById('speed').value = STATE.config.speedKmh;
      document.getElementById('players').value = STATE.config.playersCount;
      
      // POIs
      STATE.pois.forEach(poi => {
        const row = document.querySelector('tr[data-poi-id="' + poi.id + '"]');
        if (!row) return;
        const inputs = row.querySelectorAll('[data-field]');
        inputs.forEach(el => {
          const field = el.dataset.field;
          if (field === 'gps') return; // readonly
          const v = poi[field];
          // Fix: 0 must display as "0", not ""
          if (field === 'stopMinutes') {
            el.value = (typeof v === 'number') ? String(v) : '0';
          } else {
            el.value = (v === null || v === undefined) ? '' : String(v);
          }
        });
      });
      
      // Apply project sheet state
      applyProjectSheetToDOM();
      
      // Apply meta bar state
      applyMetaBarToDOM();
    }
    
    // Apply project sheet state to DOM
    function applyProjectSheetToDOM() {
      // Text inputs and selects
      const sheetInputs = document.querySelectorAll('[data-sheet-field]');
      sheetInputs.forEach(el => {
        const field = el.dataset.sheetField;
        if (STATE.project[field] !== undefined) {
          el.value = STATE.project[field];
        }
      });
      
      // Checkbox groups (audience)
      const audienceGroup = document.getElementById('sheet-audience-group');
      if (audienceGroup) {
        audienceGroup.querySelectorAll('.sheet-checkbox').forEach(label => {
          const val = label.dataset.value;
          const isActive = STATE.project.targetAudience.includes(val);
          label.classList.toggle('active', isActive);
          label.querySelector('input').checked = isActive;
        });
      }
      
      // Checkbox groups (languages)
      const langGroup = document.getElementById('sheet-languages-group');
      if (langGroup) {
        langGroup.querySelectorAll('.sheet-checkbox').forEach(label => {
          const val = label.dataset.value;
          const isActive = STATE.project.languages.includes(val);
          label.classList.toggle('active', isActive);
          label.querySelector('input').checked = isActive;
        });
      }
      
      // Toggles
      const toggles = ['qr', 'photo', 'staff', 'storytelling'];
      toggles.forEach(key => {
        const toggle = document.getElementById('sheet-' + key);
        const label = document.getElementById('sheet-' + key + '-label');
        const stateKey = key === 'qr' ? 'qrAllowed' : 
                         key === 'photo' ? 'photoAllowed' : 
                         key === 'staff' ? 'staffInvolved' : 'storytellingEnabled';
        if (toggle) {
          toggle.classList.toggle('active', STATE.project[stateKey]);
          if (label) {
            label.textContent = STATE.project[stateKey] ? 'Oui' : 'Non';
          }
        }
      });
    }
    
    // Apply meta bar state to DOM
    function applyMetaBarToDOM() {
      // Text inputs
      const metaInputs = document.querySelectorAll('[data-meta-field]');
      metaInputs.forEach(el => {
        const field = el.dataset.metaField;
        if (field === 'transportMode') {
          el.value = STATE.config.transportMode;
        } else if (field === 'speedKmh') {
          el.value = STATE.config.speedKmh;
        } else if (field === 'playersCount') {
          el.value = STATE.config.playersCount;
        } else if (STATE.meta[field] !== undefined) {
          el.value = STATE.meta[field];
        }
      });
    }
    
    // Update speed when transport mode changes (old config panel)
    function updateSpeed() {
      const mode = document.getElementById('transport').value;
      const speed = SPEED_DEFAULTS[mode] || 5;
      document.getElementById('speed').value = speed;
      STATE.config.transportMode = mode;
      STATE.config.speedKmh = speed;
      // Sync meta bar inputs
      const metaTransportSelect = document.getElementById('meta-transport-select');
      if (metaTransportSelect) metaTransportSelect.value = mode;
      const metaSpeedInput = document.getElementById('meta-speed-input');
      if (metaSpeedInput) metaSpeedInput.value = speed;
      saveState();
      recalculate();
    }
    
    // Recalculate times based on current config
    function recalculate() {
      const speed = parseFloat(document.getElementById('speed').value) || 5;
      const distanceKm = STATE.computed.totalDistanceM / 1000;
      const travelMin = (distanceKm / speed) * 60;
      
      // Sum stop times from STATE
      let stopMin = 0;
      STATE.pois.forEach(poi => {
        stopMin += parseInt(poi.stopMinutes) || 0;
      });
      
      const totalMin = travelMin + stopMin;
      
      // Update project sheet total time
      const sheetTotal = document.getElementById('sheet-total-time');
      if (sheetTotal) {
        sheetTotal.textContent = Math.round(totalMin) + ' min';
      }
      
      // Update meta bar timing
      const metaTravel = document.getElementById('meta-travel');
      if (metaTravel) {
        metaTravel.textContent = Math.round(travelMin) + ' min';
      }
      const metaStops = document.getElementById('meta-stops');
      if (metaStops) {
        metaStops.textContent = stopMin + ' min';
      }
      
      // Update STATE
      STATE.config.speedKmh = speed;
      STATE.computed.travelMinutes = travelMin;
      STATE.computed.stopMinutes = stopMin;
      STATE.computed.totalMinutes = totalMin;
      saveState();
    }
    
    // Format date helper
    function formatDate(ts) {
      if (!ts) return '—';
      try {
        const d = new Date(ts);
        return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch (e) { return '—'; }
    }
    
    // Short ID helper
    function shortId(id) {
      return id ? id.slice(0, 8) : '—';
    }
    
    // Transport mode labels
    const TRANSPORT_LABELS = { walking: '🚶 Marche', scooter: '🛵 Scooter', car: '🚗 Voiture' };
    
    // Update markers display
    function updateMarkersDisplay() {
      const markersDisplay = document.getElementById('meta-markers-display');
      if (markersDisplay) {
        markersDisplay.textContent = STATE.pois.length;
      }
    }
    
    // Shared handler for POI field updates (input, change, select)
    function handleFieldUpdate(target) {
      const poiId = target.dataset && target.dataset.poiId;
      const field = target.dataset && target.dataset.field;
      if (!poiId || !field) return;
      
      const poi = STATE.pois.find(p => p.id === poiId);
      if (!poi) return;
      
      if (field === 'stopMinutes') {
        const val = parseInt(target.value);
        poi[field] = (isNaN(val) || val < 0) ? 0 : val;
        saveState(); // save first (robust)
        recalculate();
      } else {
        poi[field] = target.value;
        saveState();
      }
    }
    
    // Event delegation: both 'input' and 'change' for inputs, selects, textareas
    document.addEventListener('input', function(e) { handleFieldUpdate(e.target); });
    document.addEventListener('change', function(e) { handleFieldUpdate(e.target); });
    
    // Project sheet field handlers
    document.querySelectorAll('[data-sheet-field]').forEach(el => {
      el.addEventListener('input', function() {
        const field = this.dataset.sheetField;
        if (['stepsCount', 'difficulty', 'durationMin'].includes(field)) {
          STATE.project[field] = parseInt(this.value) || 0;
        } else {
          STATE.project[field] = this.value;
        }
        saveState();
      });
      el.addEventListener('change', function() {
        const field = this.dataset.sheetField;
        if (['stepsCount', 'difficulty', 'durationMin'].includes(field)) {
          STATE.project[field] = parseInt(this.value) || 0;
        } else {
          STATE.project[field] = this.value;
        }
        saveState();
      });
    });
    
    // Checkbox groups (audience + languages)
    ['sheet-audience-group', 'sheet-languages-group'].forEach(groupId => {
      const group = document.getElementById(groupId);
      if (!group) return;
      group.querySelectorAll('.sheet-checkbox').forEach(label => {
        label.addEventListener('click', function(e) {
          e.preventDefault();
          const val = this.dataset.value;
          const stateKey = groupId === 'sheet-audience-group' ? 'targetAudience' : 'languages';
          const arr = STATE.project[stateKey];
          const idx = arr.indexOf(val);
          if (idx >= 0) {
            arr.splice(idx, 1);
            this.classList.remove('active');
            this.querySelector('input').checked = false;
          } else {
            arr.push(val);
            this.classList.add('active');
            this.querySelector('input').checked = true;
          }
          saveState();
        });
      });
    });
    
    // Toggle handlers
    document.querySelectorAll('[data-sheet-toggle]').forEach(toggle => {
      toggle.addEventListener('click', function() {
        const key = this.dataset.sheetToggle;
        STATE.project[key] = !STATE.project[key];
        this.classList.toggle('active', STATE.project[key]);
        const labelEl = document.getElementById('sheet-' + 
          (key === 'qrAllowed' ? 'qr' : 
           key === 'photoAllowed' ? 'photo' : 
           key === 'staffInvolved' ? 'staff' : 'storytelling') + '-label');
        if (labelEl) {
          labelEl.textContent = STATE.project[key] ? 'Oui' : 'Non';
        }
        saveState();
      });
    });
    
    // Meta bar field handlers
    document.querySelectorAll('[data-meta-field]').forEach(el => {
      const handler = function() {
        const field = this.dataset.metaField;
        if (field === 'transportMode') {
          const mode = this.value;
          const speed = SPEED_DEFAULTS[mode] || 5;
          STATE.config.transportMode = mode;
          STATE.config.speedKmh = speed;
          const speedInput = document.getElementById('meta-speed-input');
          if (speedInput) speedInput.value = speed;
          // Also sync old config panel
          document.getElementById('transport').value = mode;
          document.getElementById('speed').value = speed;
          saveState();
          recalculate();
        } else if (field === 'speedKmh') {
          const speed = parseFloat(this.value) || 5;
          STATE.config.speedKmh = speed;
          // Sync old config panel
          document.getElementById('speed').value = speed;
          saveState();
          recalculate();
        } else if (field === 'playersCount') {
          STATE.config.playersCount = parseInt(this.value) || 1;
          // Sync old config panel
          document.getElementById('players').value = this.value;
          saveState();
        } else {
          STATE.meta[field] = this.value;
          saveState();
        }
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
    
    // Speed input change (old config panel)
    document.getElementById('speed').addEventListener('input', function() {
      const speedInput = document.getElementById('meta-speed-input');
      if (speedInput) speedInput.value = this.value;
      recalculate();
    });
    
    // Players input change (old config panel)
    document.getElementById('players').addEventListener('input', function() {
      STATE.config.playersCount = parseInt(this.value) || 1;
      const playersInput = document.getElementById('meta-players-input');
      if (playersInput) playersInput.value = this.value;
      saveState();
    });
    
    // Export JSON (with edits)
    function exportJSON() {
      const exportData = {
        project: Object.assign({}, REPORT_DATA.project, STATE.project),
        trace: Object.assign({}, REPORT_DATA.trace, { 
          name: STATE.meta.traceName,
          notes: STATE.meta.routeNotes 
        }),
        meta: STATE.meta,
        config: STATE.config,
        pois: STATE.pois,
        computed: STATE.computed,
        exportedAt: new Date().toISOString()
      };
      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rapport-' + REPORT_DATA.trace.id.slice(0, 8) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    
    // Export Word (with edits)
    function exportWord() {
      const projectName = REPORT_DATA.project.name || 'Rapport';
      const projectCity = REPORT_DATA.project.city || '';
      const formatDistance = m => m >= 1000 ? (m / 1000).toFixed(2) + ' km' : Math.round(m) + ' m';
      
      const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Rapport - ' + projectName + '</title>' +
        '<style>body{font-family:Arial,sans-serif;font-size:10pt;padding:20px}' +
        'h1{color:#1a1a2e;border-bottom:2px solid #667eea;padding-bottom:10px}' +
        'h2{color:#333;margin-top:20px}.summary{background:#f5f5f5;padding:15px;margin:20px 0}' +
        'table{width:100%;border-collapse:collapse;margin-top:16px;font-size:9pt}' +
        'th,td{border:1px solid #ddd;padding:6px;text-align:left}' +
        'th{background:#f0f0f0;font-weight:bold}</style></head><body>' +
        '<h1>Rapport de Parcours</h1><p><strong>' + projectName + '</strong></p>' +
        (projectCity ? '<p style="color:#666">📍 ' + projectCity + '</p>' : '') +
        '<div class="summary"><h2>Résumé</h2>' +
        '<p><strong>Distance:</strong> ' + formatDistance(STATE.computed.totalDistanceM) + '</p>' +
        '<p><strong>Mode:</strong> ' + STATE.config.transportMode + ' @ ' + STATE.config.speedKmh + ' km/h</p>' +
        '<p><strong>Temps trajet:</strong> ' + Math.round(STATE.computed.travelMinutes) + ' min</p>' +
        '<p><strong>Temps arrêts:</strong> ' + STATE.computed.stopMinutes + ' min</p>' +
        '<p><strong>Temps total:</strong> ' + Math.round(STATE.computed.totalMinutes) + ' min</p></div>' +
        '<h2>Points d\\'intérêt (' + STATE.pois.length + ')</h2>' +
        '<table><thead><tr><th>#</th><th>Nom</th><th>Type</th><th>Action</th><th>Validation</th>' +
        '<th>Durée</th><th>Risque</th><th>Wi-Fi</th><th>GPS</th><th>Indice(s)</th><th>Notes</th></tr></thead><tbody>';
      
      let rows = '';
      STATE.pois.forEach(poi => {
        rows += '<tr><td>' + poi.order + '</td>' +
          '<td>' + (poi.name || 'POI #' + poi.order) + '</td>' +
          '<td>' + poi.functionType + '</td>' +
          '<td>' + (poi.action || '—') + '</td>' +
          '<td>' + (poi.validationType || '—') + '</td>' +
          '<td>' + poi.stopMinutes + '</td>' +
          '<td>' + poi.risk + '</td>' +
          '<td>' + poi.wifi + '</td>' +
          '<td>' + poi.lat.toFixed(5) + ', ' + poi.lng.toFixed(5) + '</td>' +
          '<td>' + (poi.hints || '—') + '</td>' +
          '<td>' + (poi.notes || '—') + '</td></tr>';
      });
      
      const footer = '</tbody></table><p style="margin-top:30px;font-size:8pt;color:#999">' +
        'Généré le ' + new Date().toLocaleDateString('fr-FR') + '</p></body></html>';
      
      const blob = new Blob([html + rows + footer], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'rapport-' + REPORT_DATA.trace.id.slice(0, 8) + '.doc';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
    
    // Initialize map
    function initMap() {
      if (typeof L === 'undefined') {
        document.getElementById('map').style.display = 'none';
        document.getElementById('map-fallback').style.display = 'flex';
        return;
      }
      
      try {
        const coords = REPORT_DATA.trace.coordinates;
        if (!coords || coords.length < 2) {
          document.getElementById('map').style.display = 'none';
          document.getElementById('map-fallback').style.display = 'flex';
          return;
        }
        
        // Convert [lng, lat] to [lat, lng] for Leaflet
        const latLngs = coords.map(c => [c[1], c[0]]);
        
        // Create map centered on route
        const map = L.map('map');
        
        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);
        
        // Add polyline
        const polyline = L.polyline(latLngs, { 
          color: '#3b82f6', 
          weight: 4,
          opacity: 0.8
        }).addTo(map);
        
        // Fit bounds
        map.fitBounds(polyline.getBounds(), { padding: [30, 30] });
        
        // Add markers
        REPORT_DATA.pois.forEach(poi => {
          const marker = L.marker([poi.lat, poi.lng]).addTo(map);
          marker.bindPopup('<strong>' + poi.emoji + ' #' + poi.order + '</strong><br>' + (poi.note || 'POI'));
        });
        
        // Add start/end markers
        if (latLngs.length > 0) {
          L.circleMarker(latLngs[0], { radius: 8, color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1 })
            .addTo(map).bindPopup('🚩 Départ');
          L.circleMarker(latLngs[latLngs.length - 1], { radius: 8, color: '#ef4444', fillColor: '#ef4444', fillOpacity: 1 })
            .addTo(map).bindPopup('🏁 Arrivée');
        }
      } catch (e) {
        console.error('Map init error:', e);
        document.getElementById('map').style.display = 'none';
        document.getElementById('map-fallback').style.display = 'flex';
      }
    }
    
    // Init on load
    loadState();
    applyStateToDOM();
    initMap();
    recalculate();
    updateHeaderMeta();
    
    // Auto print if requested
    if (AUTO_PRINT) {
      window.addEventListener('load', function() {
        setTimeout(function() { window.print(); }, 300);
      });
    }
  </script>
</body>
</html>`;
}

// ============= Generate Word Export HTML =============

/**
 * Generate a simplified HTML document for Word export (no map)
 */
export function generateWordExportHTML(payload: ReportPayload): string {
  const projectName = escapeHtml(payload.project.name);
  const projectCity = escapeHtml(payload.project.city || '');
  
  const formatDistance = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
  
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Rapport - ${projectName}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.6; padding: 20px; }
    h1 { color: #1a1a2e; border-bottom: 2px solid #667eea; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 24px; }
    .city { color: #666; font-style: italic; }
    .summary { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 8px; }
    .summary p { margin: 5px 0; }
    .summary strong { color: #667eea; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
    th { background: #f0f0f0; font-weight: bold; }
    .footer { margin-top: 30px; font-size: 9pt; color: #999; border-top: 1px solid #ddd; padding-top: 10px; }
  </style>
</head>
<body>
  <h1>Rapport de Parcours</h1>
  <p><strong>${projectName}</strong></p>
  ${projectCity ? `<p class="city">📍 ${projectCity}</p>` : ''}
  
  <div class="summary">
    <h2>Résumé</h2>
    <p><strong>Distance totale:</strong> ${formatDistance(payload.trace.totalDistanceM)}</p>
    <p><strong>Points enregistrés:</strong> ${payload.trace.coordinates.length}</p>
    <p><strong>Mode de transport:</strong> ${payload.config.transportMode === 'walking' ? 'Marche' : payload.config.transportMode === 'scooter' ? 'Scooter' : 'Voiture'}</p>
    <p><strong>Vitesse estimée:</strong> ${payload.config.speedKmh} km/h</p>
    <p><strong>Temps de trajet:</strong> ${Math.round(payload.computed.travelMinutes)} min</p>
    <p><strong>Temps d'arrêts:</strong> ${payload.computed.stopMinutes} min</p>
    <p><strong>Temps total estimé:</strong> ${Math.round(payload.computed.totalMinutes)} min</p>
  </div>
  
  <h2>Points d'intérêt (${payload.pois.length})</h2>
  ${payload.pois.length === 0 ? `<p><em>Aucun marqueur sur ce parcours</em></p>` : `
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Nom</th>
          <th>Type</th>
          <th>Action</th>
          <th>Validation</th>
          <th>Durée</th>
          <th>Risque</th>
          <th>Wi-Fi</th>
          <th>GPS</th>
          <th>Indice(s)</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        ${payload.pois.map(poi => `
          <tr>
            <td>${poi.order}</td>
            <td>${escapeHtml(poi.name || 'POI #' + poi.order)}</td>
            <td>${poi.functionType}</td>
            <td>${poi.action || '—'}</td>
            <td>${poi.validationType || '—'}</td>
            <td>${poi.stopMinutes} min</td>
            <td>${poi.risk}</td>
            <td>${poi.wifi}</td>
            <td>${poi.lat.toFixed(5)}, ${poi.lng.toFixed(5)}</td>
            <td>${escapeHtml(poi.hints || '—')}</td>
            <td>${escapeHtml(poi.notes || '—')}${poi.audioUrl ? ' 🎤 <a href="' + escapeHtml(poi.audioUrl) + '">Audio</a>' : ''}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `}
  
  <div class="footer">
    <p>Rapport généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}</p>
  </div>
</body>
</html>`;
}

// ============= Validation Comments =============

/*
 * VALIDATION RAPIDE - Cas 1: Markers vide
 * Si markers = [], alors:
 * - payload.pois = []
 * - Le tableau dans le HTML affiche "Aucun marqueur sur ce parcours"
 * - Les calculs de temps fonctionnent (stopMinutes = 0)
 * - La carte affiche la polyline sans markers POI
 * 
 * VALIDATION RAPIDE - Cas 2: Note contenant </script>
 * Si marker.note = "Test </script><script>alert('xss')</script>"
 * - escapeHtml() convertit < et > en &lt; et &gt; pour l'affichage dans le DOM
 * - JSON.stringify().replace(/<\/script>/gi, '<\\/script>') protège l'injection dans <script>
 * - Résultat: le texte s'affiche comme texte brut, pas d'exécution de script
 * 
 * VALIDATION RAPIDE - Cas 3: trace.distance_meters null
 * Si trace.distance_meters = null:
 * - totalDistanceM = sum(segmentDistancesM) via computeSegmentDistances()
 * - Les calculs de temps utilisent cette valeur calculée
 * - L'affichage fonctionne normalement
 */
