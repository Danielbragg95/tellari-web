'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabaseClient';

export default function AuthHeader() {
  const { session } = useAuth();

  const signOut = async () => {
    await supabase.auth.signOut();
    // Optional: you can force a redirect if needed:
    // window.location.href = '/login';
  };

  return (
    <header style={{ padding: 12, borderBottom: '1px solid #eee' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <Link href="/">Tellari</Link>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {session ? (
            <>
              <span>{session.user.email}</span>
              <button onClick={signOut}>Sign Out</button>
              <Link href="/profile">Profile</Link>
            </>
          ) : (
            <Link href="/login">Login</Link>
          )}
        </nav>
      </div>
    </header>
  );
}