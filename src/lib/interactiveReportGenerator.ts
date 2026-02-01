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
  };
  trace: {
    id: string;
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

/**
 * Build the report payload from project, trace, and markers data
 */
export function buildReportPayload(
  project: { hotel_name: string; city?: string },
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
  
  return {
    project: {
      name: project.hotel_name,
      city: project.city,
    },
    trace: {
      id: trace.id,
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
    
    /* POI Table */
    .pois-section {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      overflow-x: auto;
    }
    .pois-section h2 { font-size: 1.1rem; margin-bottom: 16px; color: #333; }
    table { width: 100%; border-collapse: collapse; min-width: 1200px; }
    th, td { padding: 8px 6px; text-align: left; border-bottom: 1px solid #eee; vertical-align: top; }
    th { font-size: 0.65rem; text-transform: uppercase; color: #666; font-weight: 600; white-space: nowrap; }
    td { font-size: 0.8rem; }
    .poi-input, .poi-select, .poi-textarea {
      padding: 4px 6px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 0.8rem;
      width: 100%;
      box-sizing: border-box;
    }
    .poi-input:focus, .poi-select:focus, .poi-textarea:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 2px rgba(102,126,234,0.2);
    }
    .poi-input.name { min-width: 80px; }
    .poi-input.stop { width: 50px; text-align: center; }
    .poi-input.gps { width: 100px; background: #f5f5f5; color: #666; font-size: 0.7rem; }
    .poi-select { min-width: 70px; }
    .poi-textarea { min-height: 40px; resize: vertical; font-family: inherit; }
    .poi-photo-link { color: #3498db; text-decoration: none; font-size: 0.85rem; }
    .poi-photo-link:hover { text-decoration: underline; }
    .empty-state { padding: 40px; text-align: center; color: #999; }
    
    /* Print styles */
    @media print {
      body { background: white; }
      .container { padding: 0; max-width: none; }
      header { background: #1a1a2e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .export-buttons, .config-panel { display: none !important; }
      .map-section { break-inside: avoid; }
      #map { height: 300px; }
      .summary { break-inside: avoid; }
      .stat-card.total { background: #667eea !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .pois-section { break-inside: avoid; overflow: visible; }
      table { font-size: 0.65rem; min-width: auto; }
      th, td { padding: 4px 3px; }
      .poi-input, .poi-select, .poi-textarea { border: none; padding: 0; font-size: 0.65rem; background: transparent; }
      .poi-textarea { min-height: auto; }
    }
    
    @media (max-width: 768px) {
      header { flex-direction: column; }
      .config-panel { flex-direction: column; gap: 12px; }
      .config-group { width: 100%; }
      .config-group select, .config-group input { width: 100%; }
      #map { height: 300px; }
      .pois-section { padding: 12px; }
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
    
    <div class="map-section">
      <div id="map"></div>
      <div id="map-fallback" style="display:none;">
        <div class="map-fallback-icon">🗺️</div>
        <p><strong>Carte non disponible</strong></p>
        <p>Le service de cartographie n'a pas pu être chargé.</p>
        <p style="margin-top:12px;">Distance totale: <strong>${formatDistance(payload.trace.totalDistanceM)}</strong> | ${payload.trace.coordinates.length} points</p>
      </div>
    </div>
    
    <div class="summary">
      <div class="stat-card">
        <div class="stat-label">Distance totale</div>
        <div class="stat-value" id="total-distance">${formatDistance(payload.trace.totalDistanceM)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Temps trajet</div>
        <div class="stat-value" id="travel-time">${Math.round(payload.computed.travelMinutes)} min</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Temps arrêts</div>
        <div class="stat-value" id="stop-time">${payload.computed.stopMinutes} min</div>
      </div>
      <div class="stat-card total">
        <div class="stat-label">Temps total</div>
        <div class="stat-value" id="total-time">${Math.round(payload.computed.totalMinutes)} min</div>
      </div>
    </div>
    
    <div class="pois-section">
      <h2>Points d'intérêt (${payload.pois.length})</h2>
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
                  ${poi.photoUrl ? `<a href="${escapeHtml(poi.photoUrl)}" target="_blank" class="poi-photo-link">📷</a>` : '—'}
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
  </div>
  
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
    }
    
    // Update speed when transport mode changes
    function updateSpeed() {
      const mode = document.getElementById('transport').value;
      const speed = SPEED_DEFAULTS[mode] || 5;
      document.getElementById('speed').value = speed;
      STATE.config.transportMode = mode;
      STATE.config.speedKmh = speed;
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
      
      // Update DOM
      document.getElementById('travel-time').textContent = Math.round(travelMin) + ' min';
      document.getElementById('stop-time').textContent = stopMin + ' min';
      document.getElementById('total-time').textContent = Math.round(totalMin) + ' min';
      
      // Update STATE
      STATE.config.speedKmh = speed;
      STATE.computed.travelMinutes = travelMin;
      STATE.computed.stopMinutes = stopMin;
      STATE.computed.totalMinutes = totalMin;
      saveState();
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
    
    // Speed input change
    document.getElementById('speed').addEventListener('input', function() {
      recalculate();
    });
    
    // Players input change
    document.getElementById('players').addEventListener('input', function() {
      STATE.config.playersCount = parseInt(this.value) || 1;
      saveState();
    });
    
    // Export JSON (with edits)
    function exportJSON() {
      const exportData = {
        project: REPORT_DATA.project,
        trace: REPORT_DATA.trace,
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
            <td>${escapeHtml(poi.notes || '—')}</td>
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
