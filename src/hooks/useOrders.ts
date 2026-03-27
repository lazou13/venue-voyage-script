import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useOrders() {
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ['orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, updated_at, project_id, customer_name, customer_email, experience_mode, party_size, locale, notes, status, payment_status, amount_total, currency, metadata')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const createOrder = useMutation({
    mutationFn: async (payload: {
      project_id: string;
      customer_name: string;
      customer_email?: string;
      experience_mode?: string;
      party_size?: number;
      locale?: string;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('orders')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const updateOrder = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; [key: string]: unknown }) => {
      const { data, error } = await supabase
        .from('orders')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const deleteOrder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('orders').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  return { ordersQuery, createOrder, updateOrder, deleteOrder };
}
