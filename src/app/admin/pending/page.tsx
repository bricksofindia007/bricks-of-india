import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase';
import { login, logout, approveDraft, rejectDraft } from './actions';

export const metadata: Metadata = {
  title: 'Pending Drafts | BOI Admin',
  robots: { index: false, follow: false },
};

// ── Auth check ────────────────────────────────────────────────────────────────

function isAuthed(): boolean {
  const pw = cookies().get('boi_admin')?.value;
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

// ── Login wall ────────────────────────────────────────────────────────────────

function LoginPage({ failed }: { failed?: boolean }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0F2D6B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '40px 36px', width: '100%', maxWidth: 360, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
        <h1 style={{ fontFamily: 'var(--font-fredoka)', fontSize: 24, fontWeight: 700, color: '#0F2D6B', marginBottom: 4 }}>
          BOI Admin
        </h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>Pending Drafts</p>
        {failed && (
          <p style={{ color: '#DC2626', fontSize: 13, marginBottom: 16, background: '#FEE2E2', padding: '8px 12px', borderRadius: 8 }}>
            Wrong password.
          </p>
        )}
        <form action={login}>
          <input
            type="password"
            name="password"
            placeholder="Admin password"
            required
            autoFocus
            style={{
              width: '100%', padding: '10px 12px', border: '2px solid #E4E7EB',
              borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
              marginBottom: 12, outline: 'none',
            }}
          />
          <button
            type="submit"
            style={{
              width: '100%', padding: '10px 12px', background: '#0F2D6B', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
              fontFamily: 'var(--font-fredoka)', cursor: 'pointer', letterSpacing: '0.03em',
            }}
          >
            Enter →
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Format badge ──────────────────────────────────────────────────────────────

const FORMAT_COLOUR: Record<string, { bg: string; color: string }> = {
  news:    { bg: '#DBEAFE', color: '#1E40AF' },
  review:  { bg: '#DCFCE7', color: '#166534' },
  opinion: { bg: '#FEF3C7', color: '#92400E' },
};

function FormatBadge({ format }: { format: string | null }) {
  const style = FORMAT_COLOUR[format ?? ''] ?? { bg: '#F3F4F6', color: '#4B5563' };
  return (
    <span style={{
      ...style, display: 'inline-block', padding: '2px 8px', borderRadius: 12,
      fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {format ?? 'unknown'}
    </span>
  );
}

// ── Draft card ────────────────────────────────────────────────────────────────

function DraftCard({ draft }: { draft: any }) {
  const title   = draft.draft_title || draft.source_title || '(no title)';
  const preview = draft.draft_body
    ? draft.draft_body.slice(0, 300)
    : draft.source_excerpt
    ? draft.source_excerpt.slice(0, 300)
    : null;
  const pubDate = draft.source_published_at
    ? new Date(draft.source_published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div style={{
      background: '#fff', border: '1px solid #E4E7EB', borderRadius: 12,
      padding: '20px 24px', marginBottom: 16,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <FormatBadge format={draft.draft_format} />
            {pubDate && <span style={{ fontSize: 12, color: '#9CA3AF' }}>{pubDate}</span>}
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1F2937', margin: 0, lineHeight: 1.4 }}>
            {title}
          </h2>
        </div>
      </div>

      {/* Source URL */}
      <a
        href={draft.source_url}
        target="_blank"
        rel="noopener noreferrer"
        style={{ fontSize: 12, color: '#006CB7', wordBreak: 'break-all', display: 'block', marginBottom: preview ? 10 : 0 }}
      >
        {draft.source_url}
      </a>

      {/* Body preview */}
      {preview && (
        <p style={{
          fontSize: 13, color: '#4B5563', lineHeight: 1.6, margin: '0 0 16px',
          background: '#F9FAFB', padding: '10px 12px', borderRadius: 8,
          borderLeft: '3px solid #E4E7EB',
        }}>
          {preview}
          {(draft.draft_body?.length > 300 || draft.source_excerpt?.length > 300) && ' …'}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <form action={approveDraft} style={{ margin: 0 }}>
          <input type="hidden" name="id" value={draft.id} />
          <button
            type="submit"
            style={{
              padding: '7px 18px', background: '#16A34A', color: '#fff', border: 'none',
              borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ✓ Approve
          </button>
        </form>
        <form action={rejectDraft} style={{ margin: 0 }}>
          <input type="hidden" name="id" value={draft.id} />
          <button
            type="submit"
            style={{
              padding: '7px 18px', background: '#fff', color: '#DC2626',
              border: '2px solid #DC2626', borderRadius: 8, fontSize: 13,
              fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            ✗ Reject
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function AdminPendingPage() {
  if (!isAuthed()) return <LoginPage />;

  const supabase = createServerClient();
  const { data: drafts, error } = await supabase
    .from('pending_drafts')
    .select('id, source_url, source_title, source_excerpt, source_published_at, draft_title, draft_body, draft_format, status, created_at, iteration_label')
    .eq('status', 'draft')
    .is('iteration_label', null)        // exclude RADAR-04 iteration rows (non-null labels)
    .order('created_at', { ascending: false });

  const draftsToShow = drafts ?? [];

  return (
    <div style={{ minHeight: '100vh', background: '#F7F8FA' }}>
      {/* Header */}
      <div style={{ background: '#0F2D6B', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-fredoka)', fontSize: 20, fontWeight: 700, color: '#F7A800' }}>
            BOI Admin
          </span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginLeft: 12 }}>
            Pending Drafts
          </span>
        </div>
        <form action={logout} style={{ margin: 0 }}>
          <button
            type="submit"
            style={{
              padding: '6px 14px', background: 'transparent', color: 'rgba(255,255,255,0.7)',
              border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Log out
          </button>
        </form>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '24px 16px' }}>
        {/* Stats bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>
            {error
              ? `Error loading drafts: ${error.message}`
              : `${draftsToShow.length} draft${draftsToShow.length !== 1 ? 's' : ''} awaiting review`}
          </p>
        </div>

        {/* Draft list */}
        {draftsToShow.length === 0 && !error ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontSize: 14 }}>
            No drafts pending. Check back after the next radar run.
          </div>
        ) : (
          draftsToShow.map((draft: any) => <DraftCard key={draft.id} draft={draft} />)
        )}
      </div>
    </div>
  );
}
