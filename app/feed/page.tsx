'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuth, useRole } from '@/components/AuthProvider';
import { checkPerm } from '@/components/AuthProvider';

type FeedRow = {
  id: string;
  created_at: string;
  client_id: string;
  project_id: string | null;
  project_name: string | null;
  contact_id: string | null;
  author_name: string | null;
  avatar_url: string | null;
  title: string | null;
  body: string;
  visibility: 'internal' | 'shared' | 'public';
  tags: string[];
  _readForMe?: boolean;
};

type Project = { id: string; name: string };

export default function FeedPage() {
  const { session, loading } = useAuth();
  const { isAdmin } = useRole();

  // RPC-backed flags
  const [canEditAll, setCanEditAll] = useState(false);
  const [canDeleteAll, setCanDeleteAll] = useState(false);

  const [profile, setProfile] = useState<{ client_id: string; contact_id: string } | null>(null);
  const [rows, setRows] = useState<FeedRow[]>([]);
  const [posting, setPosting] = useState(false);
  const [form, setForm] = useState({
    title: '',
    body: '',
    visibility: 'shared' as 'internal' | 'shared' | 'public',
    tags: '',
    project_id: '' as string | '',
  });

  const [projects, setProjects] = useState<Project[]>([]);
  const [filter, setFilter] = useState<{ text: string; visibility: 'all' | 'internal' | 'shared' | 'public' }>({
    text: '',
    visibility: 'all',
  });

  const [editing, setEditing] = useState<{
    id: string | null;
    title: string;
    body: string;
    visibility: 'internal' | 'shared' | 'public';
    tags: string;
    project_id: string | '';
  }>({ id: null, title: '', body: '', visibility: 'shared', tags: '', project_id: '' });

  // Load profile
  useEffect(() => {
    if (!loading && session?.user?.id) {
      supabase
        .from('user_profiles')
        .select('client_id, contact_id')
        .eq('id', session.user.id)
        .maybeSingle()
        .then(({ data }) => { if (data) setProfile(data as any); });
    }
  }, [loading, session?.user?.id]);

  // Pull perms once session is ready
  useEffect(() => {
    if (!session) return;
    const clientId: string | undefined = undefined;
    checkPerm('edit_all_messages', clientId).then(setCanEditAll);
    checkPerm('delete_all_messages', clientId).then(setCanDeleteAll);
  }, [session]);

  // Load projects for my client (for the dropdown)
  useEffect(() => {
    if (!profile?.client_id) return;
    supabase
      .from('projects')
      .select('id, name')
      .eq('client_id', profile.client_id)
      .order('name')
      .then(({ data, error }) => {
        if (error) console.warn('projects load error:', error.message);
        setProjects((data || []) as any);
      });
  }, [profile?.client_id]);

  // Fetch feed from the VIEW and enrich with read flags
  const refetch = useCallback(async () => {
    const { data, error } = await supabase
      .from('message_feed_v1')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('feed refetch error:', error.message);
      return;
    }

    let enriched = (data || []) as FeedRow[];
    if (profile?.contact_id && enriched.length) {
      const ids = enriched.map(r => r.id);
      const { data: reads, error: rErr } = await supabase
        .from('message_contacts')
        .select('message_id, read_at')
        .eq('contact_id', profile.contact_id)
        .in('message_id', ids);

      if (!rErr && reads) {
        const readMap = new Map(reads.filter((x:any) => x.read_at).map((x:any) => [x.message_id, true]));
        enriched = enriched.map(r => ({ ...r, _readForMe: !!readMap.get(r.id) }));
      }
    }
    setRows(enriched);
  }, [profile?.contact_id]);

  useEffect(() => { if (session) refetch(); }, [session, refetch]);

  // Realtime
  useEffect(() => {
    if (!session) return;
    const ch = supabase
      .channel('feed-realtime-v1')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, refetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_tags' }, refetch)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session, refetch]);

  // Create
  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) { alert('Your profile is still loading.'); return; }
    if (!form.body.trim()) return;

    setPosting(true);
    try {
      const { data: msg, error: msgErr } = await supabase
        .from('messages')
        .insert({
          client_id: profile.client_id,
          contact_id: profile.contact_id,
          project_id: form.project_id || null,
          title: form.title || null,
          body: form.body,
          visibility: form.visibility,
        })
        .select('id')
        .single();

      if (msgErr) { alert(msgErr.message); return; }

      const tags = form.tags.split(',').map(t => t.trim()).filter(Boolean);
      if (tags.length && msg?.id && (isAdmin || canEditAll)) {
        const { error: tagErr } = await supabase
          .from('message_tags')
          .insert(tags.map(tag => ({ message_id: msg.id, tag })));
        if (tagErr) console.warn('tag insert warning:', tagErr.message);
      }

      setForm({ title: '', body: '', visibility: 'shared', tags: '', project_id: '' });
      await refetch();
    } catch (err: any) {
      console.error('post error', err);
      alert(err?.message || 'Failed to post');
    } finally {
      setPosting(false);
    }
  };

  const meContactId = profile?.contact_id;

  const filtered = useMemo(() => {
    const base = rows;
    const byVis = filter.visibility === 'all' ? base : base.filter(r => r.visibility === filter.visibility);
    if (!filter.text.trim()) return byVis;
    const needle = filter.text.toLowerCase();
    return byVis.filter(r => {
      const hay = `${r.title ?? ''} ${r.body} ${(r.tags || []).join(' ')} ${r.author_name ?? ''} ${r.project_name ?? ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, filter]);

  const markRead = async (messageId: string) => {
    if (!meContactId) return;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('message_contacts')
      .upsert({ message_id: messageId, contact_id: meContactId, read_at: now });
    if (error) { alert(error.message); return; }
    setRows(rs => rs.map(r => (r.id === messageId ? { ...r, _readForMe: true } : r)));
  };

  // Edit
  const startEdit = (r: FeedRow) =>
    setEditing({
      id: r.id,
      title: r.title || '',
      body: r.body,
      visibility: r.visibility,
      tags: (r.tags || []).join(', '),
      project_id: r.project_id || '',
    });
  const cancelEdit = () => setEditing({ id: null, title: '', body: '', visibility: 'shared', tags: '', project_id: '' });

  const handleSaveEdit = async () => {
    if (!editing.id) return;
    const { error: upErr } = await supabase
      .from('messages')
      .update({
        title: editing.title || null,
        body: editing.body,
        visibility: editing.visibility,
        project_id: editing.project_id || null,
      })
      .eq('id', editing.id);
    if (upErr) { alert(upErr.message); return; }

    const tags = editing.tags.split(',').map(t => t.trim()).filter(Boolean);
    if (isAdmin || canEditAll) {
      await supabase.from('message_tags').delete().eq('message_id', editing.id);
      if (tags.length) {
        const { error: tagErr } = await supabase
          .from('message_tags')
          .insert(tags.map(tag => ({ message_id: editing.id!, tag })));
        if (tagErr) console.warn('tag replace warning:', tagErr.message);
      }
    }
    await refetch();
    cancelEdit();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this message?')) return;
    if (!(isAdmin || canDeleteAll)) { alert('You do not have permission to delete messages.'); return; }
    const { error } = await supabase.from('messages').delete().eq('id', id);
    if (error) { alert(error.message); return; }
    await refetch();
  };

  if (loading) return <main style={{ padding: 24 }}>Loading…</main>;
  if (!session) return <main style={{ padding: 24 }}>Please log in.</main>;

  return (
    <main style={{ padding: 24, display: 'grid', gap: 24, maxWidth: 920, margin: '0 auto' }}>
      {/* Composer */}
      <section style={{ border: '1px solid #eee', padding: 16, borderRadius: 8 }}>
        <h2 style={{ marginBottom: 12 }}>New Message</h2>
        <form onSubmit={handlePost} style={{ display: 'grid', gap: 8, maxWidth: 700 }}>
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <label>Visibility:</label>
            <select
              value={form.visibility}
              onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as any }))}
            >
              <option value="internal">Internal</option>
              <option value="shared">Shared</option>
              <option value="public">Public</option>
            </select>

            <label>Project:</label>
            <select value={form.project_id} onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}>
              <option value="">(none)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {(isAdmin || canEditAll) && (
              <input
                placeholder="tags (comma separated)"
                value={form.tags}
                onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                style={{ flex: 1, minWidth: 220 }}
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
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <input
              placeholder="Search text…"
              value={filter.text}
              onChange={(e) => setFilter((f) => ({ ...f, text: e.target.value }))}
              style={{ flex: 1, minWidth: 240 }}
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
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Avatar name={r.author_name || 'Unknown'} url={r.avatar_url || undefined} />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{r.title || 'Update'}</strong>
                    <Chip>{r.visibility}</Chip>
                    {r.project_name && <Chip>Project: {r.project_name}</Chip>}
                    {r.tags?.map((t) => (
                      <Chip key={t}>#{t}</Chip>
                    ))}
                  </div>
                </div>
                <small>{new Date(r.created_at).toLocaleString()}</small>
              </header>

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
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <select
                      value={editing.visibility}
                      onChange={(e) => setEditing((ed) => ({ ...ed, visibility: e.target.value as any }))}
                    >
                      <option value="internal">Internal</option>
                      <option value="shared">Shared</option>
                      <option value="public">Public</option>
                    </select>
                    <select
                      value={editing.project_id}
                      onChange={(e) => setEditing((ed) => ({ ...ed, project_id: e.target.value }))}
                    >
                      <option value="">(none)</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    {(isAdmin || canEditAll) && (
                      <input
                        placeholder="tags (comma separated)"
                        value={editing.tags}
                        onChange={(e) => setEditing((ed) => ({ ...ed, tags: e.target.value }))}
                        style={{ flex: 1, minWidth: 220 }}
                      />
                    )}
                    <button onClick={handleSaveEdit}>Save</button>
                    <button type="button" onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{r.body}</p>
                  <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <ReadBadge read={r as any} />
                    <button onClick={() => markRead(r.id)} disabled={!profile?.contact_id || (r as any)._readForMe}>
                      {(r as any)._readForMe ? 'Read' : 'Mark as read'}
                    </button>
                  </div>
                </>
              )}

              {(canEdit || canDelete) && editing.id !== r.id && (
                <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
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

function Avatar({ name, url }: { name: string; url?: string }) {
  const initials = (name || 'U')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0]?.toUpperCase())
    .slice(0, 2)
    .join('') || 'U';
  const size = 28;
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 600,
    border: '1px solid #ddd',
    background: '#f7f7f7',
  };
  if (url) {
    return <img src={url} alt={name} width={size} height={size} style={{ borderRadius: '50%', objectFit: 'cover', border: '1px solid #ddd' }} />;
  }
  return <span style={style}>{initials}</span>;
}
