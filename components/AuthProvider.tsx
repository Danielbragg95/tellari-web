'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  role: 'admin' | 'client' | null;
};

const AuthCtx = createContext<AuthContextValue>({
  session: null,
  loading: true,
  role: null,
});

export const useAuth = () => useContext(AuthCtx);

// Helper to use role easily
export const useRole = () => {
  const { role, loading } = useAuth();
  return { role, isAdmin: role === 'admin', isClient: role === 'client', loading };
};

async function fetchRole(userId: string): Promise<'admin' | 'client' | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)            // id matches auth.users.id
    .maybeSingle();

  if (error) {
    console.warn('fetchRole error:', error.message);
    return null;
  }
  return (data?.role as 'admin' | 'client' | null) ?? null;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<'admin' | 'client' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const sess = data.session ?? null;
      setSession(sess);

      if (sess?.user?.id) {
        setRole(await fetchRole(sess.user.id));
      } else {
        setRole(null);
      }
      setLoading(false);
    };

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession ?? null);

      if (newSession?.user?.id) {
        setRole(await fetchRole(newSession.user.id));
      } else {
        setRole(null);
      }
    });

    init();
    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthCtx.Provider value={{ session, loading, role }}>
      {children}
    </AuthCtx.Provider>
  );
}
