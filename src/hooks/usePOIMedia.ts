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
  created_at: string;
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

      const ext = file.name.split('.').pop() ?? 'bin';
      const storagePath = `${medinaPoiId}/${crypto.randomUUID()}.${ext}`;

      // Upload to private bucket
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, file, { cacheControl: '3600', upsert: false });
      if (upErr) throw upErr;

      // Insert metadata row
      const { data, error: insErr } = await supabase
        .from('poi_media')
        .insert({
          medina_poi_id: medinaPoiId,
          media_type: mediaType,
          storage_bucket: BUCKET,
          storage_path: storagePath,
          mime_type: file.type || null,
          size_bytes: file.size,
          duration_sec: null,
          caption: null,
          role_tags: [] as Json,
          is_cover: false,
          sort_order: 0,
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
    }: {
      mediaId: string;
      mediaType: 'photo' | 'audio' | 'video';
    }) => {
      if (!medinaPoiId) throw new Error('No POI selected');

      // Unset all covers for this POI + type
      await supabase
        .from('poi_media')
        .update({ is_cover: false })
        .eq('medina_poi_id', medinaPoiId)
        .eq('media_type', mediaType);

      // Set this one
      const { error } = await supabase
        .from('poi_media')
        .update({ is_cover: true })
        .eq('id', mediaId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: mediaQueryKey(medinaPoiId!) }),
  });

  const updateMedia = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<POIMedia> & { id: string }) => {
      const { error } = await supabase
        .from('poi_media')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: mediaQueryKey(medinaPoiId!) }),
  });

  const removeMedia = useMutation({
    mutationFn: async (media: POIMedia) => {
      // Delete from storage first
      await supabase.storage.from(BUCKET).remove([media.storage_path]);
      // Then delete row
      const { error } = await supabase.from('poi_media').delete().eq('id', media.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: mediaQueryKey(medinaPoiId!) }),
  });

  // Helper: get signed URL for admin preview
  const getSignedUrl = async (storagePath: string, expiresIn = 3600) => {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(storagePath, expiresIn);
    if (error) throw error;
    return data.signedUrl;
  };

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
