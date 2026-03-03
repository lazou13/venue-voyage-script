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

// In-memory signed URL cache
const urlCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL_MS = 12 * 60 * 1000; // 12 min (URLs expire in 15)

export function usePlayInstance(accessToken: string | null) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PlayData | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    };
    tick();
    timerRef.current = setInterval(tick, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isStarted, isExpired, data?.instance.expires_at]);

  const start = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnErr } = await supabase.functions.invoke('start-instance', {
        body: { access_token: accessToken },
      });
      if (fnErr) throw fnErr;
      if (result?.error) {
        setError(result.error);
      } else {
        setData(result as PlayData);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

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

  return { loading, error, data, start, isStarted, isExpired, remainingSeconds, getMediaUrls };
}
