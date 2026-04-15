import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isReady: boolean;
  isAdmin: boolean;
  isAdminLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signOut: () => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminLoading, setIsAdminLoading] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setIsAdminLoading(false);
      return;
    }

    let cancelled = false;
    setIsAdminLoading(true);

    supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' })
      .then(({ data, error }) => {
        if (!cancelled) {
          setIsAdmin(!error && data === true);
          setIsAdminLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    // 1. Set up listener FIRST (Supabase recommended order)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        // Mark ready on first auth event if not already
        setIsReady(true);
      }
    );

    // 2. THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    return supabase.auth.signInWithPassword({ email, password });
  };

  const signOut = async () => {
    return supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, isReady, isAdmin, isAdminLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
