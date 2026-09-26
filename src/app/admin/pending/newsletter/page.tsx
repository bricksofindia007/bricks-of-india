import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/metadata';
import Link from 'next/link';
import { cookies, type UnsafeUnwrappedCookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase';
import { login, logout } from '../actions';
import { approveNewsletterDraft, dismissNewsletterDraft } from './actions';

export const metadata: Metadata = buildMetadata({
  title: 'Newsletter — BOI Admin',
  description: 'Bricks of India admin: newsletter draft review and approval.',
  path: '/admin/pending/newsletter',
  robots: { index: false, follow: false },
});

// Same check as /admin/pending — duplicated inline rather than shared,
// matching the existing convention in this admin area (see
// src/app/admin/pending/growth/[[...path]]/route.ts's own comment).
function isAuthed(): boolean {
  const pw = (cookies() as unknown as UnsafeUnwrappedCookies).get('boi_admin')?.value;
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0F2D6B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '40px 36px', width: '100%', maxWidth: 360, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
        <h1 style={{ fontFamily: 'var(--font-fredoka)', fontSize: 24, fontWeight: 700, color: '#0F2D6B', marginBottom: 4 }}>BOI Admin</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>Newsletter</p>
        <form action={login}>
          <input
            type="password" name="password" placeholder="Admin password" required autoFocus
            style={{ width: '100%', padding: '10px 12px', border: '2px solid #E4E7EB', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12, outline: 'none' }}
          />
          <button type="submit" style={{ width: '100%', padding: '10px 12px', background: '#0F2D6B', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, fontFamily: 'var(--font-fredoka)', cursor: 'pointer' }}>
            Enter →
          </button>
        </form>
      </div>
    </div>
  );
}

interface Subscriber {
  id: string;
  email: string;
  subscribed_at: string;
  is_active: boolean;
}

interface NewsletterDraft {
  id: string;
  status: string;
  subject: string;
  issue_number: number | null;
  created_at: string;
  content: {
    copy?: {
      boi_take?: string;
      big_one_blurb?: string;
      price_radar_captions?: string[] | Record<string, string>;
      verdict_digest_lines?: string[] | Record<string, string>;
      featured_set_spotlight?: string;
    };
  };
}

// price_radar_captions / verdict_digest_lines come back as either a
// plain array or an object keyed by set_id/review_id, depending on
// which generator run produced the draft (real, observed variance —
// not a bug introduced here). Normalize both to a display list.
function listValues(v: string[] | Record<string, string> | undefined): string[] {
  if (!v) return [];
  return Array.isArray(v) ? v : Object.values(v);
}

function DraftCard({ draft }: { draft: NewsletterDraft }) {
  const copy = draft.content?.copy ?? {};
  const priceRadar = listValues(copy.price_radar_captions);
  const verdicts = listValues(copy.verdict_digest_lines);

  return (
    <div style={{ background: '#fff', border: '1px solid #E4E7EB', borderRadius: 12, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: '#F7A800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Issue #{draft.issue_number ?? '?'}
        </span>
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>
          created {new Date(draft.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
        </span>
      </div>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1F2937', margin: '0 0 12px' }}>{draft.subject}</h2>

      {copy.boi_take && (
        <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, marginBottom: 10 }}>
          <strong>Opener: </strong>{copy.boi_take}
        </p>
      )}
      {copy.big_one_blurb && (
        <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, marginBottom: 10 }}>
          <strong>Big one: </strong>{copy.big_one_blurb}
        </p>
      )}
      {priceRadar.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <strong style={{ fontSize: 13, color: '#374151' }}>Price radar:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13, color: '#4B5563' }}>
            {priceRadar.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      )}
      {verdicts.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <strong style={{ fontSize: 13, color: '#374151' }}>Verdict digest:</strong>
          <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13, color: '#4B5563' }}>
            {verdicts.map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      )}
      {copy.featured_set_spotlight && (
        <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.5, marginBottom: 14 }}>
          <strong>Featured spotlight: </strong>{copy.featured_set_spotlight}
        </p>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <form action={approveNewsletterDraft} style={{ margin: 0 }}>
          <input type="hidden" name="id" value={draft.id} />
          <button type="submit" style={{ padding: '8px 16px', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✓ Approve
          </button>
        </form>
        <form action={dismissNewsletterDraft} style={{ margin: 0 }}>
          <input type="hidden" name="id" value={draft.id} />
          <button type="submit" style={{ padding: '8px 16px', background: 'transparent', color: '#991B1B', border: '1px solid #FCA5A5', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✕ Dismiss
          </button>
        </form>
      </div>
      <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10, marginBottom: 0 }}>
        Approving only changes status to &apos;approved&apos; — sending still requires a manual
        <code style={{ background: '#F3F4F6', padding: '1px 5px', borderRadius: 4, marginLeft: 4 }}>growth-newsletter-send.yml</code> dispatch with this draft&apos;s id.
      </p>
    </div>
  );
}

export default async function NewsletterAdminPage() {
  if (!isAuthed()) return <LoginPage />;

  const supabase = createServerClient();

  const [{ data: subscribers, error: subErr }, { data: drafts, error: draftErr }] = await Promise.all([
    supabase
      .from('newsletter_subscribers')
      .select('id, email, subscribed_at, is_active')
      .order('subscribed_at', { ascending: false }),
    supabase
      .schema('growth')
      .from('newsletter_drafts')
      .select('id, status, subject, issue_number, created_at, content')
      .eq('status', 'pending_approval')
      .order('issue_number', { ascending: true }),
  ]);

  if (subErr) console.error('[admin/newsletter] newsletter_subscribers read error:', subErr);
  if (draftErr) console.error('[admin/newsletter] growth.newsletter_drafts read error:', draftErr);

  const subs = (subscribers ?? []) as Subscriber[];
  const activeSubs = subs.filter((s) => s.is_active);
  const pendingDrafts = (drafts ?? []) as NewsletterDraft[];

  return (
    <div style={{ minHeight: '100vh', background: '#F7F8FA' }}>
      <div style={{ background: '#0F2D6B', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-fredoka)', fontSize: 20, fontWeight: 700, color: '#F7A800' }}>BOI Admin</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginLeft: 12 }}>Newsletter</span>
          <Link href="/admin/pending" style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginLeft: 16 }}>← Pending Drafts</Link>
        </div>
        <form action={logout} style={{ margin: 0 }}>
          <button type="submit" style={{ padding: '6px 14px', background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Log out
          </button>
        </form>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px' }}>

        {/* ── Subscribers ── */}
        <div style={{ background: '#fff', border: '1px solid #E4E7EB', borderRadius: 12, padding: '16px 20px', marginBottom: 24 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1F2937', margin: '0 0 4px' }}>
            Subscribers — {activeSubs.length} active {subs.length !== activeSubs.length && `(${subs.length} total)`}
          </h2>
          {subErr && <p style={{ fontSize: 12, color: '#991B1B' }}>Failed to load — see server logs.</p>}
          {subs.length === 0 && !subErr && (
            <p style={{ fontSize: 13, color: '#6B7280', margin: '8px 0 0' }}>No subscribers yet.</p>
          )}
          {subs.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10, fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6B7280', fontSize: 11, textTransform: 'uppercase' }}>
                  <th style={{ paddingBottom: 6 }}>Email</th>
                  <th style={{ paddingBottom: 6 }}>Subscribed</th>
                  <th style={{ paddingBottom: 6 }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {subs.map((s) => (
                  <tr key={s.id} style={{ borderTop: '1px solid #F3F4F6' }}>
                    <td style={{ padding: '6px 0', color: '#374151' }}>{s.email}</td>
                    <td style={{ padding: '6px 0', color: '#6B7280' }}>
                      {new Date(s.subscribed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td style={{ padding: '6px 0' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: s.is_active ? '#166534' : '#991B1B' }}>
                        {s.is_active ? 'active' : 'inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Pending newsletter drafts ── */}
        <h2 style={{ fontSize: 14, fontWeight: 700, color: '#1F2937', margin: '0 0 4px' }}>
          Newsletter drafts awaiting review ({pendingDrafts.length})
        </h2>
        <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 14px' }}>
          Generated automatically by the growth-engine pipeline. Reads/writes growth.newsletter_drafts directly —
          the same table the real send workflow uses, not a separate system.
        </p>
        {draftErr && (
          <p style={{ fontSize: 12, color: '#991B1B' }}>Failed to load drafts — see server logs.</p>
        )}
        {pendingDrafts.length === 0 && !draftErr ? (
          <p style={{ fontSize: 13, color: '#6B7280' }}>No drafts pending review right now.</p>
        ) : (
          pendingDrafts.map((draft) => <DraftCard key={draft.id} draft={draft} />)
        )}
      </div>
    </div>
  );
}
