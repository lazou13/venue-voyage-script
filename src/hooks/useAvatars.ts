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

// Placeholder avatar data for seeding
const PLACEHOLDER_AVATARS: Omit<AvatarInsert, 'project_id'>[] = [
  { name: 'Luna', style: 'cartoon', persona: 'guide_host', age: 'adult', outfit: 'modern', image_url: 'https://ui-avatars.com/api/?name=Luna&size=200&background=6366f1&color=fff&bold=true' },
  { name: 'Max', style: 'realistic', persona: 'detective', age: 'adult', outfit: 'adventure', image_url: 'https://ui-avatars.com/api/?name=Max&size=200&background=22c55e&color=fff&bold=true' },
  { name: 'Sofia', style: 'anime', persona: 'explorer', age: 'teen', outfit: 'modern', image_url: 'https://ui-avatars.com/api/?name=Sofia&size=200&background=ec4899&color=fff&bold=true' },
  { name: 'Karim', style: 'semi_realistic', persona: 'historian', age: 'senior', outfit: 'traditional', image_url: 'https://ui-avatars.com/api/?name=Karim&size=200&background=f59e0b&color=fff&bold=true' },
  { name: 'Yuki', style: 'minimal', persona: 'ai_assistant', age: 'adult', outfit: 'modern', image_url: 'https://ui-avatars.com/api/?name=Yuki&size=200&background=06b6d4&color=fff&bold=true' },
  { name: 'Theo', style: 'cartoon', persona: 'mascot', age: 'child', outfit: 'adventure', image_url: 'https://ui-avatars.com/api/?name=Theo&size=200&background=8b5cf6&color=fff&bold=true' },
  { name: 'Nadia', style: 'realistic', persona: 'local_character', age: 'adult', outfit: 'traditional', image_url: 'https://ui-avatars.com/api/?name=Nadia&size=200&background=ef4444&color=fff&bold=true' },
  { name: 'Jade', style: 'anime', persona: 'villain_light', age: 'teen', outfit: 'luxury', image_url: 'https://ui-avatars.com/api/?name=Jade&size=200&background=10b981&color=fff&bold=true' },
  { name: 'Omar', style: 'cartoon', persona: 'guide_host', age: 'adult', outfit: 'adventure', image_url: 'https://ui-avatars.com/api/?name=Omar&size=200&background=3b82f6&color=fff&bold=true' },
  { name: 'Emma', style: 'semi_realistic', persona: 'explorer', age: 'adult', outfit: 'modern', image_url: 'https://ui-avatars.com/api/?name=Emma&size=200&background=d946ef&color=fff&bold=true' },
];

export function useAvatars(projectId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch avatars: global (project_id IS NULL) + project-specific
  const avatarsQuery = useQuery({
    queryKey: ['avatars', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from('avatars')
        .select('id, created_at, project_id, name, style, age, persona, outfit, image_url')
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

  // Seed 10 placeholder avatars (all global) with duplicate prevention
  const seedPlaceholderAvatars = useMutation({
    mutationFn: async () => {
      // Check existing avatars to prevent duplicates
      const { data: existing } = await supabase
        .from('avatars')
        .select('name, style, persona, age, outfit')
        .is('project_id', null);
      
      const existingSet = new Set(
        (existing || []).map(a => `${a.name}|${a.style}|${a.persona}|${a.age}|${a.outfit}`)
      );
      
      const avatarsToInsert = PLACEHOLDER_AVATARS
        .filter(avatar => !existingSet.has(`${avatar.name}|${avatar.style}|${avatar.persona}|${avatar.age}|${avatar.outfit}`))
        .map(avatar => ({
          ...avatar,
          project_id: null, // All placeholders are global
        }));
      
      if (avatarsToInsert.length === 0) return; // Nothing new to insert
      
      const { error } = await supabase
        .from('avatars')
        .insert(avatarsToInsert);
      
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalidate both global and project-specific avatar queries
      queryClient.invalidateQueries({ queryKey: ['avatars'] });
    },
  });

  return {
    avatars: avatarsQuery.data || [],
    isLoading: avatarsQuery.isLoading,
    addAvatar,
    deleteAvatar,
    seedPlaceholderAvatars,
    isSeeding: seedPlaceholderAvatars.isPending,
  };
}
