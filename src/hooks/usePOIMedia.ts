import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface POIMedia {
  id: string;
  medina_poi_id: string;
  media_type: 'photo' | 'audio' | 'video';
  storage_bucket: string;
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  duration_sec: number | null;
  caption: string | null;
  role_tags: string[];
  is_cover: boolean;
  sort_order: number;
  extra: Record<string, unknown>;
  created_at: string;
}

// ─── Upload limits ──────────────────────────────────────────
const ALLOWED_EXTENSIONS: Record<string, string[]> = {
  photo: ['jpg', 'jpeg', 'png', 'webp'],
  audio: ['mp3', 'm4a'],
  video: ['mp4'],
};

const MAX_SIZE: Record<string, number> = {
  photo: 4 * 1024 * 1024,       // 4 MB
  audio: 10 * 1024 * 1024,      // 10 MB
  video: 40 * 1024 * 1024,      // 40 MB
};

const MAX_DURATION: Record<string, number> = {
  audio: 60,
  video: 30,
};

function validateFile(file: File, mediaType: 'photo' | 'audio' | 'video') {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS[mediaType].includes(ext)) {
    throw new Error(
      `Format non autorisé (.${ext}). Formats acceptés : ${ALLOWED_EXTENSIONS[mediaType].join(', ')}`
    );
  }
  if (file.size > MAX_SIZE[mediaType]) {
    const maxMB = MAX_SIZE[mediaType] / (1024 * 1024);
    throw new Error(`Fichier trop lourd (${(file.size / (1024 * 1024)).toFixed(1)} Mo). Max : ${maxMB} Mo`);
  }
}

// Probe media duration + dimensions via browser APIs
function probeMedia(file: File, mediaType: 'photo' | 'audio' | 'video'): Promise<{
  width?: number;
  height?: number;
  durationSec?: number;
}> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    if (mediaType === 'photo') {
      const img = new window.Image();
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => { resolve({}); URL.revokeObjectURL(url); };
      img.src = url;
    } else {
      const el = mediaType === 'audio'
        ? new Audio()
        : document.createElement('video');
      el.preload = 'metadata';
      el.onloadedmetadata = () => {
        const result: Record<string, number> = {};
        if (isFinite(el.duration)) result.durationSec = Math.round(el.duration);
        if ('videoWidth' in el && (el as HTMLVideoElement).videoWidth) {
          result.width = (el as HTMLVideoElement).videoWidth;
          result.height = (el as HTMLVideoElement).videoHeight;
        }
        resolve(result);
        URL.revokeObjectURL(url);
      };
      el.onerror = () => { resolve({}); URL.revokeObjectURL(url); };
      el.src = url;
    }
  });
}

// ─── Signed URL cache (in-memory, 10 min TTL) ──────────────
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

async function getCachedSignedUrl(storagePath: string): Promise<string> {
  const cached = signedUrlCache.get(storagePath);
  if (cached && cached.expiresAt > Date.now()) return cached.url;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 3600);
  if (error) throw error;

  signedUrlCache.set(storagePath, {
    url: data.signedUrl,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
  return data.signedUrl;
}

const BUCKET = 'poi-media';

function mediaQueryKey(medinaPoiId: string) {
  return ['poi_media', medinaPoiId];
}

export function usePOIMedia(medinaPoiId: string | undefined) {
  const qc = useQueryClient();

  const listQuery = useQuery({
    queryKey: mediaQueryKey(medinaPoiId ?? ''),
    queryFn: async () => {
      if (!medinaPoiId) return [];
      const { data, error } = await supabase
        .from('poi_media')
        .select('*')
        .eq('medina_poi_id', medinaPoiId)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as POIMedia[];
    },
    enabled: !!medinaPoiId,
  });

  const uploadMedia = useMutation({
    mutationFn: async ({
      file,
      mediaType,
    }: {
      file: File;
      mediaType: 'photo' | 'audio' | 'video';
    }) => {
      if (!medinaPoiId) throw new Error('No POI selected');

      // 1. Validate format + size
      validateFile(file, mediaType);

      // 2. Probe metadata (dimensions, duration)
      const probe = await probeMedia(file, mediaType);

      // 3. Validate duration if applicable
      if (probe.durationSec && MAX_DURATION[mediaType] && probe.durationSec > MAX_DURATION[mediaType]) {
        throw new Error(
          `Durée trop longue (${probe.durationSec}s). Max : ${MAX_DURATION[mediaType]}s`
        );
      }

      // 4. Upload to private bucket
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
      const storagePath = `${medinaPoiId}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;

      // 5. Build extra metadata
      const extra: Record<string, unknown> = {};
      if (probe.width) extra.width = probe.width;
      if (probe.height) extra.height = probe.height;
      if (probe.durationSec) extra.durationSec = probe.durationSec;

      // 6. Insert row
      const { data, error: insErr } = await supabase
        .from('poi_media')
        .insert({
          medina_poi_id: medinaPoiId,
          media_type: mediaType,
          storage_bucket: BUCKET,
          storage_path: storagePath,
          mime_type: file.type || null,
          size_bytes: file.size,
          duration_sec: probe.durationSec ?? null,
          caption: null,
          role_tags: [] as Json,
          is_cover: false,
          sort_order: 0,
          extra: extra as Json,
        })
        .select()
        .single();
      if (insErr) throw insErr;
      return data as POIMedia;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: mediaQueryKey(medinaPoiId!) }),
  });

  const setCover = useMutation({
    mutationFn: async ({
      mediaId,
      mediaType,
      currentRoleTags,
    }: {
      mediaId: string;
      mediaType: 'photo' | 'audio' | 'video';
      currentRoleTags?: string[];
    }) => {
      if (!medinaPoiId) throw new Error('No POI selected');

      // Unset all covers for this POI + type
      await supabase
        .from('poi_media')
        .update({ is_cover: false })
        .eq('medina_poi_id', medinaPoiId)
        .eq('media_type', mediaType);

      // Set this one + add 'repere' tag if photo and role_tags empty
      const updates: Record<string, unknown> = { is_cover: true };
      if (mediaType === 'photo' && (!currentRoleTags || currentRoleTags.length === 0)) {
        updates.role_tags = ['repere'] as Json;
      }

      const { error } = await supabase
        .from('poi_media')
        .update(updates)
        .eq('id', mediaId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: mediaQueryKey(medinaPoiId!) }),
  });

  const updateMedia = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<POIMedia> & { id: string }) => {
      const payload: Record<string, unknown> = { ...updates };
      if (updates.role_tags) payload.role_tags = updates.role_tags as unknown as Json;
      if (updates.extra) payload.extra = updates.extra as unknown as Json;
      const { error } = await supabase
        .from('poi_media')
        .update(payload)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: mediaQueryKey(medinaPoiId!) }),
  });

  const removeMedia = useMutation({
    mutationFn: async (media: POIMedia) => {
      await supabase.storage.from(BUCKET).remove([media.storage_path]);
      const { error } = await supabase.from('poi_media').delete().eq('id', media.id);
      if (error) throw error;
      // Evict from cache
      signedUrlCache.delete(media.storage_path);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: mediaQueryKey(medinaPoiId!) }),
  });

  // Cached signed URL (photos auto-load; audio/video on-demand)
  const getSignedUrl = (storagePath: string) => getCachedSignedUrl(storagePath);

  return {
    media: listQuery.data ?? [],
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    uploadMedia,
    setCover,
    updateMedia,
    removeMedia,
    getSignedUrl,
  };
}
