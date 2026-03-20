/**
 * deviceFingerprint.ts
 *
 * Device identity sécurisée pour le device lock des quêtes.
 *
 * Stratégie :
 * 1. Génère un fingerprint multi-signaux (navigateur, écran, timezone, canvas)
 * 2. Génère un ID stable stocké dans localStorage + sessionStorage + cookie
 * 3. Combine les deux : l'ID stable EST le vrai identifiant, le fingerprint
 *    sert à détecter un changement d'appareil (contournement).
 *
 * Résistance :
 * - Effacer localStorage seul → l'ID est récupéré depuis sessionStorage ou cookie
 * - Effacer tout → nouveau device_id, mais fingerprint change aussi → refusé
 * - Navigation privée → fingerprint légèrement différent → traité comme nouvel appareil
 */

const STORAGE_KEY = 'qr_device_id';
const SESSION_KEY = 'qr_device_session';
const COOKIE_NAME = 'qr_did';
const COOKIE_MAX_AGE_DAYS = 365;

// ── Cookie helpers ──────────────────────────────────────────────────────────

function setCookie(value: string): void {
  const maxAge = COOKIE_MAX_AGE_DAYS * 86400;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; Max-Age=${maxAge}; Path=/; SameSite=Strict${secure}`;
}

function getCookie(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// ── Stable ID (multi-storage) ───────────────────────────────────────────────

function readStoredId(): string | null {
  // Priority: localStorage > sessionStorage > cookie
  try {
    const ls = localStorage.getItem(STORAGE_KEY);
    if (ls) return ls;
  } catch { /* private mode */ }

  try {
    const ss = sessionStorage.getItem(SESSION_KEY);
    if (ss) return ss;
  } catch { /* private mode */ }

  return getCookie();
}

function writeStoredId(id: string): void {
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* private mode */ }
  try { sessionStorage.setItem(SESSION_KEY, id); } catch { /* private mode */ }
  setCookie(id);
}

// ── Canvas fingerprint ──────────────────────────────────────────────────────

function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 50;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#f60';
    ctx.fillRect(125, 1, 62, 20);
    ctx.fillStyle = '#069';
    ctx.fillText('Quest🗺', 2, 15);
    ctx.fillStyle = 'rgba(102,204,0,0.7)';
    ctx.fillText('Quest🗺', 4, 17);
    return canvas.toDataURL().slice(-64); // Last 64 chars is a stable digest
  } catch {
    return 'no-canvas';
  }
}

// ── Multi-signal fingerprint hash ───────────────────────────────────────────

async function buildFingerprint(): Promise<string> {
  const nav = navigator;
  const signals = [
    nav.userAgent,
    nav.language,
    nav.languages?.join(',') ?? '',
    String(nav.hardwareConcurrency ?? 0),
    String((nav as unknown as Record<string, unknown>).deviceMemory ?? 0),
    String(screen.width),
    String(screen.height),
    String(screen.colorDepth),
    String(new Date().getTimezoneOffset()),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    getCanvasFingerprint(),
  ].join('|');

  // SHA-256 via Web Crypto
  const encoder = new TextEncoder();
  const data = encoder.encode(signals);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface DeviceIdentity {
  /** Stable ID — envoyé comme `device_id` à start-instance */
  deviceId: string;
  /** Hash fingerprint multi-signaux — envoyé comme `device_fingerprint` */
  fingerprint: string;
}

let _cached: DeviceIdentity | null = null;

/**
 * Retourne l'identité de l'appareil.
 * L'ID stable est créé une fois et persiste dans localStorage/sessionStorage/cookie.
 * Le fingerprint est recalculé à chaque appel (mais mis en cache en mémoire).
 */
export async function getDeviceIdentity(): Promise<DeviceIdentity> {
  if (_cached) return _cached;

  // 1. Get or create stable ID
  let deviceId = readStoredId();
  if (!deviceId) {
    deviceId = typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    writeStoredId(deviceId);
  } else {
    // Refresh all storage layers in case one was cleared
    writeStoredId(deviceId);
  }

  // 2. Build fingerprint
  const fingerprint = await buildFingerprint();

  _cached = { deviceId, fingerprint };
  return _cached;
}

/**
 * Invalider le cache (ex: après une erreur device_locked, pour permettre
 * la régénération si l'utilisateur efface réellement son stockage).
 */
export function clearDeviceCache(): void {
  _cached = null;
}
