import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PlayInstance {
  id: string;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
  ttl_minutes: number;
  score: Record<string, unknown>;
}

interface PlayProject {
  id: string;
  title_i18n: Record<string, string>;
  quest_config: Record<string, unknown>;
  theme: string | null;
  city: string;
}

interface PlayPOI {
  id: string;
  sort_order: number;
  name: string;
  step_config: Record<string, unknown>;
  zone: string;
  interaction: string;
}

export interface PlayData {
  instance: PlayInstance;
  project: PlayProject;
  pois: PlayPOI[];
}

// In-memory signed URL cache (shared across renders)
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL_MS = 12 * 60 * 1000; // 12 min (URLs expire in 15)

/** Extract cover photo ID from a POI's step_config.media */
function getCoverPhotoId(poi: PlayPOI): string | null {
  const media = poi.step_config?.media as Record<string, unknown> | undefined;
  if (!media) return null;
  if (typeof media.coverPhotoId === 'string') return media.coverPhotoId;
  // Fallback: first photoId
  const photoIds = media.photoIds;
  if (Array.isArray(photoIds) && typeof photoIds[0] === 'string') return photoIds[0];
  return null;
}

/** Get prioritized media IDs for initial load (cover + 2 photos + 1 audio + 1 video) */
export function getPriorityMediaIds(poi: PlayPOI): { priority: string[]; remaining: string[] } {
  const media = poi.step_config?.media as Record<string, unknown> | undefined;
  if (!media) return { priority: [], remaining: [] };

  const all: string[] = [];
  const priority: string[] = [];

  const coverId = typeof media.coverPhotoId === 'string' ? media.coverPhotoId : null;
  const photoIds = Array.isArray(media.photoIds) ? media.photoIds.filter((id): id is string => typeof id === 'string') : [];
  const audioIds = Array.isArray(media.audioIds) ? media.audioIds.filter((id): id is string => typeof id === 'string') : [];
  const videoIds = Array.isArray(media.videoIds) ? media.videoIds.filter((id): id is string => typeof id === 'string') : [];

  // Cover first
  if (coverId) priority.push(coverId);
  // Then up to 2 photos (excluding cover)
  for (const id of photoIds) {
    if (id !== coverId && priority.length < (coverId ? 3 : 2)) priority.push(id);
  }
  // 1 audio
  if (audioIds[0]) priority.push(audioIds[0]);
  // 1 video
  if (videoIds[0]) priority.push(videoIds[0]);

  // Build all unique
  if (coverId) all.push(coverId);
  all.push(...photoIds.filter((id) => id !== coverId));
  all.push(...audioIds);
  all.push(...videoIds);

  const prioritySet = new Set(priority);
  const remaining = all.filter((id) => !prioritySet.has(id));

  return { priority: [...new Set(priority)], remaining: [...new Set(remaining)] };
}

export function usePlayInstance(accessToken: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlayData | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [coverUrls, setCoverUrls] = useState<Record<string, string>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const preloadedRef = useRef(false);

  const isStarted = !!data?.instance.starts_at;
  const isExpired =
    data?.instance.status === 'expired' ||
    (data?.instance.expires_at != null && new Date(data.instance.expires_at) < new Date());

  // Timer tick
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (!isStarted || isExpired || !data?.instance.expires_at) {
      setRemainingSeconds(null);
      return;
    }

    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(data.instance.expires_at!).getTime() - Date.now()) / 1000));
      setRemainingSeconds(left);
      // Stop interval when timer reaches 0 (B6 fix)
      if (left <= 0 && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStarted, isExpired, data?.instance.expires_at]);

  /** Fetch signed URLs for a set of media IDs (cached). */
  const getMediaUrls = useCallback(
    async (mediaIds: string[]): Promise<Record<string, string>> => {
      if (!accessToken || mediaIds.length === 0) return {};

      const now = Date.now();
      const result: Record<string, string> = {};
      const needed: string[] = [];

      for (const id of mediaIds) {
        const cached = urlCache.get(id);
        if (cached && cached.expiresAt > now) {
          result[id] = cached.url;
        } else {
          needed.push(id);
        }
      }

      if (needed.length === 0) return result;

      try {
        const { data: resp, error: fnErr } = await supabase.functions.invoke('get-media-urls', {
          body: { access_token: accessToken, media_ids: needed },
        });
        if (fnErr) throw fnErr;
        if (resp?.error) throw new Error(resp.error);

        const urls = (resp?.urls || {}) as Record<string, string>;
        const expiry = now + CACHE_TTL_MS;
        for (const [id, url] of Object.entries(urls)) {
          urlCache.set(id, { url, expiresAt: expiry });
          result[id] = url;
        }
      } catch (e) {
        console.error('getMediaUrls error:', e);
      }

      return result;
    },
    [accessToken]
  );

  const start = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnErr } = await supabase.functions.invoke('start-instance', {
        body: { access_token: accessToken },
      });
      if (fnErr) {
        // Handle 410 Gone (expired instance) specifically (B9 fix)
        const status = (fnErr as any)?.status || (fnErr as any)?.context?.status;
        if (status === 410) {
          setError('expired');
        } else {
          throw fnErr;
        }
      } else if (result?.error) {
        // Edge function returned an error in the body
        if (result.error === 'Instance expirée') {
          setError('expired');
        } else {
          setError(result.error);
        }
      } else {
        setData(result as PlayData);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  // Preload covers for first 5 POIs after data loads
  useEffect(() => {
    if (!data || preloadedRef.current) return;
    preloadedRef.current = true;

    const coverIds: string[] = [];
    for (const poi of data.pois.slice(0, 5)) {
      const cid = getCoverPhotoId(poi);
      if (cid) coverIds.push(cid);
    }
    if (coverIds.length === 0) return;

    getMediaUrls(coverIds).then((result) => {
      setCoverUrls(result);
    });
  }, [data, getMediaUrls]);

  return {
    loading, error, data, start, isStarted, isExpired, remainingSeconds,
    getMediaUrls, coverUrls,
  };
}
