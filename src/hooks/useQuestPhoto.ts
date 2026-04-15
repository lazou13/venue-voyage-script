import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UploadResult { ok: boolean; path?: string; error?: string }

export function useQuestPhoto(accessToken: string | null, instanceId: string | null) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadPhoto = useCallback(async (
    file: File,
    poiId: string | null,
    deviceId: string | null
  ): Promise<UploadResult> => {
    if (!accessToken || !instanceId) return { ok: false, error: 'Pas de session' };
    setUploading(true);
    setError(null);

    try {
      // Convert to base64
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      const isVideo = file.type.startsWith('video/');

      // Get GPS if available
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* GPS optional */ }

      const { data, error: fnErr } = await supabase.functions.invoke('client-feedback', {
        body: {
          access_token: accessToken,
          type: 'photo',
          data: base64,
          media_type: isVideo ? 'video' : 'photo',
          poi_id: poiId,
          lat,
          lng,
          device_id: deviceId,
        },
      });

      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      return { ok: true, path: data?.path };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur upload';
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setUploading(false);
    }
  }, [accessToken, instanceId]);

  const submitRecommendation = useCallback(async (params: {
    poiName?: string;
    medinaPoiId?: string;
    comment?: string;
    rating?: number;
  }): Promise<UploadResult> => {
    if (!accessToken) return { ok: false, error: 'Pas de session' };
    setUploading(true);
    setError(null);

    try {
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch { /* GPS optional */ }

      const { data, error: fnErr } = await supabase.functions.invoke('client-feedback', {
        body: {
          access_token: accessToken,
          type: 'recommendation',
          poi_name: params.poiName,
          medina_poi_id: params.medinaPoiId,
          comment: params.comment,
          rating: params.rating,
          lat,
          lng,
        },
      });

      if (fnErr) throw fnErr;
      if (data?.error) throw new Error(data.error);

      return { ok: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Erreur recommandation';
      setError(msg);
      return { ok: false, error: msg };
    } finally {
      setUploading(false);
    }
  }, [accessToken]);

  return { uploading, error, uploadPhoto, submitRecommendation };
}
