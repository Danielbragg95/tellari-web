'use client';

import Link from 'next/link';
import { useAuth, useRole } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabaseClient';

export default function AuthHeader() {
  const { session } = useAuth();
  const { role, isAdmin } = useRole();

  const signOut = async () => {
    await supabase.auth.signOut();
    // window.location.href = '/login'; // optional hard redirect
  };

  return (
    <header style={{ padding: 12, borderBottom: '1px solid #eee' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <Link href="/">Tellari</Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {session ? (
            <>
              {/* role badge */}
              <span style={{ padding: '2px 8px', border: '1px solid #ddd', borderRadius: 8, fontSize: 12 }}>
                {role ?? '…'}
              </span>

              {/* Links visible when signed in */}
              <Link href="/feed">Feed</Link>
              <Link href="/profile">Profile</Link>
              {isAdmin && <Link href="/admin">Admin</Link>}

              <span>{session.user.email}</span>
              <button onClick={signOut}>Sign Out</button>
            </>
          ) : (
            <Link href="/login">Login</Link>
          )}
        </nav>
      </div>
    </header>
  );
}