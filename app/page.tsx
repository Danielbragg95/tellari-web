'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Profile = { id: string; contact_id: string; client_id: string; role: 'admin'|'client' };

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile|null>(null);
  const [error, setError] = useState<string>('');
  const router = useRouter();

  // Check login on load
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login');
      } else {
        setUser(data.user);
      }
    });
  }, [router]);

  // Fetch profile if logged in
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id, contact_id, client_id, role')
        .single();
      if (error) setError(error.message);
      else setProfile(data as Profile);
    })();
  }, [user]);

  if (!user) return null;

  return (
    <main style={{padding:40}}>
      <h2>Profile</h2>
      {error && <div style={{color:'crimson'}}>{error}</div>}
      {!error && profile && (
        <pre>{JSON.stringify({ user: user.email, profile }, null, 2)}</pre>
      )}
    </main>
  );
}