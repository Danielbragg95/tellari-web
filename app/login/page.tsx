'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function LoginPage() {
  const [email, setEmail] = useState('daniel@test.com');
  const [password, setPassword] = useState('Test1234!');
  const [msg, setMsg] = useState('');

  async function doLogin(e:any) {
    e.preventDefault();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setMsg(error ? error.message : `Logged in: ${data.user?.email}`);
  }

  return (
    <main style={{maxWidth:420,margin:'4rem auto',display:'grid',gap:12}}>
      <h1>Login</h1>
      <form onSubmit={doLogin} style={{display:'grid',gap:8}}>
        <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="email" />
        <input value={password} onChange={e=>setPassword(e.target.value)} placeholder="password" type="password" />
        <button type="submit">Sign In</button>
      </form>
      <div>{msg}</div>
      <a href="/profile">Go to Profile</a>
    </main>
  );
}
