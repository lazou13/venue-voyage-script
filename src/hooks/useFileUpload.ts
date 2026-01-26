import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useFileUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const uploadFile = async (file: File, path: string): Promise<string> => {
    setIsUploading(true);
    setProgress(0);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${path}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('fieldwork')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('fieldwork')
        .getPublicUrl(fileName);

      setProgress(100);
      return publicUrl;
    } finally {
      setIsUploading(false);
    }
  };

  const deleteFile = async (url: string): Promise<void> => {
    const path = url.split('/fieldwork/')[1];
    if (path) {
      await supabase.storage.from('fieldwork').remove([path]);
    }
  };

  return {
    uploadFile,
    deleteFile,
    isUploading,
    progress,
  };
}
