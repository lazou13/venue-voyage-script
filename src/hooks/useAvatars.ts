import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Avatar, AvatarStyle, AvatarAge, AvatarPersona, AvatarOutfit } from '@/types/intake';

interface AvatarInsert {
  project_id: string | null;
  name: string;
  style: AvatarStyle;
  age: AvatarAge;
  persona: AvatarPersona;
  outfit: AvatarOutfit;
  image_url: string;
}

export function useAvatars(projectId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch avatars: global (project_id IS NULL) + project-specific
  const avatarsQuery = useQuery({
    queryKey: ['avatars', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('avatars')
        .select('*')
        .or(`project_id.is.null,project_id.eq.${projectId}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as Avatar[];
    },
    enabled: !!projectId,
  });

  const addAvatar = useMutation({
    mutationFn: async (avatar: AvatarInsert) => {
      const { data, error } = await supabase
        .from('avatars')
        .insert(avatar)
        .select()
        .single();
      if (error) throw error;
      return data as Avatar;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatars', projectId] });
    },
  });

  const deleteAvatar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('avatars').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['avatars', projectId] });
    },
  });

  return {
    avatars: avatarsQuery.data || [],
    isLoading: avatarsQuery.isLoading,
    addAvatar,
    deleteAvatar,
  };
}
