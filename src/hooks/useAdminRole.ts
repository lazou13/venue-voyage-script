import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useAdminRole(userId: string | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    const checkRole = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const { data, error: rpcError } = await supabase.rpc('has_role', { 
          _user_id: userId, 
          _role: 'admin' 
        });
        
        if (rpcError) {
          console.error('Error checking admin role:', rpcError);
          setError(rpcError.message);
          setIsAdmin(false);
        } else {
          setIsAdmin(data === true);
        }
      } catch (e) {
        console.error('Unexpected error checking role:', e);
        setError('Erreur lors de la vérification du rôle');
        setIsAdmin(false);
      } finally {
        setIsLoading(false);
      }
    };

    checkRole();
  }, [userId]);

  return { isAdmin, isLoading, error };
}
