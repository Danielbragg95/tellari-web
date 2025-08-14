'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';

type RoleType = 'admin' | 'client' | 'manager' | null;

type AuthContextValue = {
  session: Session | null;
  loading: boolean;
  role: RoleType;
};

const AuthCtx = createContext<AuthContextValue>({
  session: null,
  loading: true,
  role: null,
});

export const useAuth = () => useContext(AuthCtx);

// Simple role flags (+ a stubby hasPerm for older UI paths)
export const useRole = () => {
  const { role, loading } = useAuth();
  return {
    role,
    isAdmin: role === 'admin',
    isClient: role === 'client',
    isManager: role === 'manager',
    loading,
    hasPerm: (perm: string) => {
      if (role === 'admin') return true;
      if (role === 'manager') return perm !== 'system_settings';
      return false;
    },
  };
};

/**
 * RPC-backed permission check.
 * Calls has_perm_rpc(p text, target_client_id text) on the server.
 */
export async function checkPerm(perm: string, clientId?: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('has_perm_rpc', {
    p: perm,
    target_client_id: clientId ?? null,
  });
  if (error) {
    console.warn('checkPerm failed:', error.message);
    return false;
  }
  return !!data;
}

async function fetchRole(userId: string): Promise<RoleType> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('fetchRole error:', error.message);
    return null;
  }
  return (data?.role as RoleType) ?? null;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<RoleType>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      const sess = data.session ?? null;
      setSession(sess);

      if (sess?.user?.id) setRole(await fetchRole(sess.user.id));
      else setRole(null);

      setLoading(false);
    };

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_evt, newSession) => {
      setSession(newSession ?? null);
      if (newSession?.user?.id) setRole(await fetchRole(newSession.user.id));
      else setRole(null);
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
