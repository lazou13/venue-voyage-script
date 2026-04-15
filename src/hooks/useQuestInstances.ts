import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useQuestInstances(orderId: string | undefined) {
  const queryClient = useQueryClient();

  const instancesQuery = useQuery({
    queryKey: ['quest_instances', orderId],
    enabled: !!orderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quest_instances')
        .select('id, created_at, updated_at, order_id, project_id, access_token, status, ttl_minutes, starts_at, expires_at, device_id, device_uses, devices_allowed, score')
        .eq('order_id', orderId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createInstance = useMutation({
    mutationFn: async (payload: {
      order_id: string;
      project_id: string;
      ttl_minutes?: number;
    }) => {
      const { data, error } = await supabase
        .from('quest_instances')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quest_instances', orderId] });
    },
  });

  const updateInstance = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; [key: string]: unknown }) => {
      const { data, error } = await supabase
        .from('quest_instances')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quest_instances', orderId] });
    },
  });

  const deleteInstance = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('quest_instances').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quest_instances', orderId] });
    },
  });

  return { instancesQuery, createInstance, updateInstance, deleteInstance };
}
