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

// Keep simple role flags, and retain stubby hasPerm for now (UI may still call it)
export const useRole = () => {
  const { role, loading } = useAuth();
  return {
    role,
    isAdmin: role === 'admin',
    isClient: role === 'client',
    isManager: role === 'manager',
    loading,
    hasPerm: (perm: string) => {
      // Temporary UI helper; true permissions are enforced in SQL via has_perm().
      if (role === 'admin') return true;
      if (role === 'manager') return perm !== 'system_settings';
      return false;
    },
  };
};

/**
 * checkPerm
 * Calls the Supabase RPC `has_perm_rpc(p text, target_client_id text)` which wraps
 * the Postgres function `has_perm(auth.uid(), p, client_id)`.
 * - Admins automatically pass inside SQL (no need to special-case here).
 * - Optionally pass clientId to check per-client scope.
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
    .eq('id', userId) // id matches auth.users.id
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
