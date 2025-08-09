'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function ProfilePage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login');
    }
  }, [loading, session, router]);

  if (loading) return <main>Loading…</main>;
  if (!session) return null; // redirecting

  return (
    <main style={{ padding: 24 }}>
      <h1>Profile</h1>
      <p>Signed in as <strong>{session.user.email}</strong></p>
      {/* You can also fetch and render user_profiles here if desired */}
    </main>
  );
}