'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth, useRole } from '@/components/AuthProvider';

type MsgRow = {
  id: string;
  client_id: string;
  contact_id: string | null;
  title: string | null;
  body: string;
  visibility: 'internal' | 'shared' | 'public';
  created_at: string;
  message_tags?: { tag: string }[];
  message_contacts?: { contact_id: string; read_at: string | null }[];
};

export default function FeedPage() {
  const { session, loading } = useAuth();
  const { isAdmin, hasPerm } = useRole();

  // Permission helpers (synchronous; backed by role for now)
  const canEditAll = hasPerm('edit_all_messages');
  const canDeleteAll = hasPerm('delete_all_messages');

  const [profile, setProfile] = useState<{ client_id: string; contact_id: string } | null>(null);
  const [rows, setRows] = useState<MsgRow[]>([]);
  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    body: '',
    visibility: 'shared' as 'internal' | 'shared' | 'public',
    tags: '',
  });

  // Admin/staff filters
  const [filter, setFilter] = useState<{ text: string; visibility: 'all' | 'internal' | 'shared' | 'public' }>({
    text: '',
    visibility: 'all',
  });

  // Inline edit state
  const [editing, setEditing] = useState<{
    id: string | null;
    title: string;
    body: string;
    visibility: 'internal' | 'shared' | 'public';
    tags: string;
  }>({ id: null, title: '', body: '', visibility: 'shared', tags: '' });

  // Fetch list
  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('messages')
      .select(
        'id, client_id, contact_id, title, body, visibility, created_at, message_tags(tag), message_contacts(contact_id, read_at)'
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('refetch error:', error.message);
      return;
    }
    setRows((data || []) as any);
  }, []);

  // Load my profile
  useEffect(() => {
    if (!loading && session?.user?.id) {
      supabase
        .from('user_profiles')
        .select('client_id, contact_id')
        .eq('id', session.user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setProfile(data as any);
        });
    }
  }, [loading, session?.user?.id]);

  // Initial load
  useEffect(() => {
    if (session) refetch();
  }, [session, refetch]);

  // Realtime: on any change, refetch
  useEffect(() => {
    if (!session) return;
    const ch = supabase
      .channel('feed-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_tags' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_contacts' }, refetch)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [session, refetch]);

  // Create message: write -> (optionally tags) -> refetch
  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) {
      alert('Your profile is still loading. Try again in a second.');
      return;
    }

    setPosting(true);
    try {
      const { data: msg, error: msgErr } = await supabase
        .from('messages')
        .insert({
          client_id: profile.client_id,
          contact_id: profile.contact_id,
          title: form.title || null,
          body: form.body,
          visibility: form.visibility,
        })
        .select('id')
        .single();

      if (msgErr) {
        alert(msgErr.message);
        return;
      }

      const tags = form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      if (tags.length && msg?.id && (isAdmin || canEditAll)) {
        // Admins or staff with edit_all_messages can write tags
        const { error: tagErr } = await supabase
          .from('message_tags')
          .insert(tags.map((tag) => ({ message_id: msg.id, tag })));
        if (tagErr) console.warn('tag insert warning:', tagErr.message);
      }

      setForm({ title: '', body: '', visibility: 'shared', tags: '' });
      await refetch();
    } catch (err: any) {
      console.error('post error', err);
      alert(err?.message || 'Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const meContactId = profile?.contact_id;

  // Compute read flag for me
  const rowsWithRead = useMemo(() => {
    return rows.map((r) => {
      const mine = r.message_contacts?.find((mc) => mc.contact_id === meContactId);
      return { ...r, _readForMe: !!mine?.read_at };
    });
  }, [rows, meContactId]);

  // Admin/staff filters (text + visibility)
  const filtered = useMemo(() => {
    const base = rowsWithRead;
    const byVis = filter.visibility === 'all' ? base : base.filter((r) => r.visibility === filter.visibility);
    if (!filter.text.trim()) return byVis;
    const needle = filter.text.toLowerCase();
    return byVis.filter((r) => {
      const hay = `${r.title ?? ''} ${r.body} ${(r.message_tags || []).map((t) => t.tag).join(' ')}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rowsWithRead, filter]);

  // Mark read
  const markRead = async (messageId: string) => {
    if (!meContactId) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('message_contacts')
      .upsert({ message_id: messageId, contact_id: meContactId, read_at: now });

    if (error) {
      alert(error.message);
      return;
    }
    await refetch();
  };

  // Edit helpers
  const startEdit = (r: MsgRow) =>
    setEditing({
      id: r.id,
      title: r.title || '',
      body: r.body,
      visibility: r.visibility,
      tags: (r.message_tags || []).map((t) => t.tag).join(', '),
    });
  const cancelEdit = () => setEditing({ id: null, title: '', body: '', visibility: 'shared', tags: '' });

  const handleSaveEdit = async () => {
    if (!editing.id) return;
    const { error: upErr } = await supabase
      .from('messages')
      .update({
        title: editing.title || null,
        body: editing.body,
        visibility: editing.visibility,
      })
      .eq('id', editing.id);

    if (upErr) {
      alert(upErr.message);
      return;
    }

    // Replace tags (admins or staff with edit_all_messages)
    const tags = editing.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    if (isAdmin || canEditAll) {
      await supabase.from('message_tags').delete().eq('message_id', editing.id);
      if (tags.length) {
        const { error: tagErr } = await supabase
          .from('message_tags')
          .insert(tags.map((tag) => ({ message_id: editing.id!, tag })));
        if (tagErr) console.warn('tag replace warning:', tagErr.message);
      }
    }

    await refetch();
    cancelEdit();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this message?')) return;
    const canDelete = isAdmin || canDeleteAll;
    if (!canDelete) {
      alert('You do not have permission to delete messages.');
      return;
    }
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error) {
      alert(error.message);
      return;
    }
    await refetch();
  };

  if (loading) return <main style={{ padding: 24 }}>Loading…</main>;
  if (!session) return <main style={{ padding: 24 }}>Please log in.</main>;

  return (
    <main style={{ padding: 24, display: 'grid', gap: 24, maxWidth: 920, margin: '0 auto' }}>
      {/* Composer */}
      <section style={{ border: '1px solid #eee', padding: 16, borderRadius: 8 }}>
        <h2 style={{ marginBottom: 12 }}>New Message</h2>
        <form onSubmit={handlePost} style={{ display: 'grid', gap: 8, maxWidth: 600 }}>
          <input
            placeholder="Title (optional)"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <textarea
            placeholder="Write an update…"
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            rows={4}
          />
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label>Visibility:</label>
            <select
              value={form.visibility}
              onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as any }))}
            >
              <option value="internal">Internal</option>
              <option value="shared">Shared</option>
              <option value="public">Public</option>
            </select>
            {(isAdmin || canEditAll) && (
              <input
                placeholder="tags (comma separated)"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                style={{ flex: 1 }}
              />
            )}
          </div>
          <button disabled={posting || !form.body.trim()}>{posting ? 'Posting…' : 'Post'}</button>
        </form>
      </section>

      {/* Admin & staff filters */}
      {(isAdmin || canEditAll) && (
        <section style={{ border: '1px solid #eee', padding: 12, borderRadius: 8 }}>
          <strong>Admin & staff filters</strong>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              placeholder="Search text…"
              value={filter.text}
              onChange={(e) => setFilter((f) => ({ ...f, text: e.target.value }))}
              style={{ flex: 1 }}
            />
            <select
              value={filter.visibility}
              onChange={(e) => setFilter((f) => ({ ...f, visibility: e.target.value as any }))}
            >
              <option value="all">All</option>
              <option value="internal">Internal</option>
              <option value="shared">Shared</option>
              <option value="public">Public</option>
            </select>
          </div>
        </section>
      )}

      {/* List */}
      <section style={{ display: 'grid', gap: 12 }}>
        <h2>Feed</h2>
        {filtered.length === 0 && <p>No messages yet.</p>}
        {filtered.map((r) => {
          const iOwnIt = r.contact_id && profile?.contact_id === r.contact_id && profile?.client_id === r.client_id;
          const canEdit = isAdmin || canEditAll || iOwnIt;
          const canDelete = isAdmin || canDeleteAll || iOwnIt;

          return (
            <article key={r.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <strong>{r.title || 'Update'}</strong>
                  <Chip>{r.visibility}</Chip>
                  {(r.message_tags || []).map((t) => (
                    <Chip key={t.tag}>#{t.tag}</Chip>
                  ))}
                </div>
                <small>{new Date(r.created_at).toLocaleString()}</small>
              </div>

              {editing.id === r.id ? (
                <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                  <input
                    value={editing.title}
                    onChange={(e) => setEditing((ed) => ({ ...ed, title: e.target.value }))}
                    placeholder="Title (optional)"
                  />
                  <textarea
                    value={editing.body}
                    onChange={(e) => setEditing((ed) => ({ ...ed, body: e.target.value }))}
                    rows={4}
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select
                      value={editing.visibility}
                      onChange={(e) => setEditing((ed) => ({ ...ed, visibility: e.target.value as any }))}
                    >
                      <option value="internal">Internal</option>
                      <option value="shared">Shared</option>
                      <option value="public">Public</option>
                    </select>
                    {(isAdmin || canEditAll) && (
                      <input
                        placeholder="tags (comma separated)"
                        value={editing.tags}
                        onChange={(e) => setEditing((ed) => ({ ...ed, tags: e.target.value }))}
                        style={{ flex: 1 }}
                      />
                    )}
                    <button onClick={handleSaveEdit}>Save</button>
                    <button type="button" onClick={cancelEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{r.body}</p>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                    <ReadBadge read={r as any} />
                    <button onClick={() => markRead(r.id)} disabled={!profile?.contact_id || (r as any)._readForMe}>
                      {(r as any)._readForMe ? 'Read' : 'Mark as read'}
                    </button>
                  </div>
                </>
              )}

              {(canEdit || canDelete) && editing.id !== r.id && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                  {canEdit && <button onClick={() => startEdit(r)}>Edit</button>}
                  {canDelete && <button onClick={() => handleDelete(r.id)}>Delete</button>}
                </div>
              )}
            </article>
          );
        })}
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

function ReadBadge({ read }: { read: any }) {
  const isRead = !!read._readForMe;
  return <span style={{ fontSize: 12, opacity: 0.8 }}>{isRead ? 'Read' : 'Unread'}</span>;
}
