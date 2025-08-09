'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useRole } from '@/components/AuthProvider';

export default function AdminPage() {
  const { isAdmin, loading } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAdmin) router.replace('/');
  }, [loading, isAdmin, router]);

  if (loading) return <main>Loading…</main>;
  if (!isAdmin) return null;

  return (
    <main style={{ padding: 24 }}>
      <h1>Admin</h1>
      <p>Only admins can see this page.</p>
    </main>
  );
}
