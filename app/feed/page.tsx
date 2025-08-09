'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/components/AuthProvider';

type MsgRow = {
  id: string;
  client_id: string;
  contact_id: string | null; // sender
  title: string | null;
  body: string;
  visibility: 'internal' | 'shared' | 'public';
  created_at: string;
  message_tags?: { tag: string }[];
  message_contacts?: { contact_id: string; read_at: string | null }[];
};

export default function FeedPage() {
  const { session, loading } = useAuth();
  const [profile, setProfile] = useState<{ client_id: string; contact_id: string } | null>(null);
  const [rows, setRows] = useState<MsgRow[]>([]);
  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', visibility: 'shared' as 'internal'|'shared'|'public', tags: '' });

  // Grab my client_id + contact_id
  useEffect(() => {
    if (!loading && session?.user?.id) {
      supabase.from('user_profiles')
        .select('client_id, contact_id')
        .eq('id', session.user.id)
        .maybeSingle()
        .then(({ data }) => { if (data) setProfile(data as any); });
    }
  }, [loading, session?.user?.id]);

  // Load messages
  useEffect(() => {
    if (!session) return;
    supabase.from('messages')
      .select('id, client_id, contact_id, title, body, visibility, created_at, message_tags(tag), message_contacts(contact_id, read_at)')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) setRows(data as any);
      });
  }, [session]);

  // Post a new message
  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setPosting(true);
    const { data, error } = await supabase.from('messages').insert({
      client_id: profile.client_id,
      contact_id: profile.contact_id,
      title: form.title || null,
      body: form.body,
      visibility: form.visibility,
    }).select().single();

    if (!error && data) {
      // tags (admins can insert tags by policy)
      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tags.length) {
        await supabase.from('message_tags').insert(tags.map(tag => ({ message_id: data.id, tag })));
      }
      setRows(prev => [{ ...data, message_tags: tags.map(tag => ({ tag })), message_contacts: [] }, ...prev] as any);
      setForm({ title: '', body: '', visibility: 'shared', tags: '' });
    } else {
      console.warn('post error', error?.message);
      alert(error?.message || 'Failed to post');
    }
    setPosting(false);
  };

  const meContactId = profile?.contact_id;
  const rowsWithRead = useMemo(() => {
    return rows.map(r => {
      const mine = r.message_contacts?.find(mc => mc.contact_id === meContactId);
      const read = !!mine?.read_at;
      return { ...r, _readForMe: read };
    });
  }, [rows, meContactId]);

  // Mark a message read for me (creates or updates my recipient row)
  const markRead = async (messageId: string) => {
    if (!meContactId) return;
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('message_contacts')
      .upsert({ message_id: messageId, contact_id: meContactId, read_at: now });

    if (!error) {
      setRows(prev =>
        prev.map(r => {
          if (r.id !== messageId) return r;
          const arr = r.message_contacts ? [...r.message_contacts] : [];
          const idx = arr.findIndex(x => x.contact_id === meContactId);
          if (idx >= 0) arr[idx] = { ...arr[idx], read_at: now };
          else arr.push({ contact_id: meContactId, read_at: now });
          return { ...r, message_contacts: arr };
        })
      );
    } else {
      console.warn('markRead error', error.message);
      alert(error.message);
    }
  };

  if (loading) return <main style={{ padding: 24 }}>Loading…</main>;
  if (!session) return <main style={{ padding: 24 }}>Please log in.</main>;

  return (
    <main style={{ padding: 24, display: 'grid', gap: 24 }}>
      {/* Composer */}
      <section style={{ border: '1px solid #eee', padding: 16, borderRadius: 8 }}>
        <h2 style={{ marginBottom: 12 }}>New Message</h2>
        <form onSubmit={handlePost} style={{ display: 'grid', gap: 8, maxWidth: 600 }}>
          <input
            placeholder="Title (optional)"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          />
          <textarea
            placeholder="Write an update…"
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            rows={4}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label>Visibility:</label>
            <select
              value={form.visibility}
              onChange={e => setForm(f => ({ ...f, visibility: e.target.value as any }))}
            >
              <option value="internal">Internal</option>
              <option value="shared">Shared</option>
              <option value="public">Public</option>
            </select>
            <input
              placeholder="tags (comma separated)"
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              style={{ flex: 1 }}
            />
          </div>
          <button disabled={posting || !form.body.trim()}>{posting ? 'Posting…' : 'Post'}</button>
        </form>
      </section>

      {/* List */}
      <section style={{ display: 'grid', gap: 12 }}>
        <h2>Feed</h2>
        {rowsWithRead.length === 0 && <p>No messages yet.</p>}
        {rowsWithRead.map(r => (
          <article key={r.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <strong>{r.title || 'Update'}</strong>
                <Chip>{r.visibility}</Chip>
                {(r.message_tags || []).map(t => <Chip key={t.tag}>#{t.tag}</Chip>)}
              </div>
              <small>{new Date(r.created_at).toLocaleString()}</small>
            </div>

            <p style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{r.body}</p>

            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <ReadBadge read={r as any} meContactId={meContactId || ''} />
              <button onClick={() => markRead(r.id)} disabled={!meContactId || (r as any)._readForMe}>
                {(r as any)._readForMe ? 'Read' : 'Mark as read'}
              </button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 12, padding: '2px 8px', border: '1px solid #ddd', borderRadius: 999 }}>
      {children}
    </span>
  );
}

function ReadBadge({ read, meContactId }: { read: any; meContactId: string }) {
  const isRead = !!read._readForMe;
  return (
    <span style={{ fontSize: 12, opacity: 0.8 }}>
      {isRead ? 'Read' : 'Unread'}
    </span>
  );
}
