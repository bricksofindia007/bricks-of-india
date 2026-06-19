import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { createServerClient } from '@/lib/supabase';
import { login, logout, approveDraft, rejectDraft, approveAll, generateArticle, publishDraft } from './actions';
import { GenerateBatchButton } from './GenerateBatchButton';
import { PublishAllButton } from './PublishAllButton';
import { DraftBodyExpander } from './DraftBodyExpander';

export const metadata: Metadata = {
  title: 'Pending Drafts | BOI Admin',
  robots: { index: false, follow: false },
};

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthed(): boolean {
  const pw = cookies().get('boi_admin')?.value;
  return !!pw && pw === process.env.ADMIN_PASSWORD;
}

// ── URL helpers ───────────────────────────────────────────────────────────────

type Filters = { status?: string; format?: string; domain?: string };

function buildUrl(current: Filters, override: Partial<Filters>): string {
  const merged = { ...current, ...override };
  const p = new URLSearchParams();
  if (merged.status && merged.status !== 'draft') p.set('status', merged.status);
  if (merged.format) p.set('format', merged.format);
  if (merged.domain) p.set('domain', merged.domain);
  const qs = p.toString();
  return qs ? `/admin/pending?${qs}` : '/admin/pending';
}

function extractDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

// ── Login wall ────────────────────────────────────────────────────────────────

function LoginPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0F2D6B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 12, padding: '40px 36px', width: '100%', maxWidth: 360, boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
        <h1 style={{ fontFamily: 'var(--font-fredoka)', fontSize: 24, fontWeight: 700, color: '#0F2D6B', marginBottom: 4 }}>BOI Admin</h1>
        <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 24 }}>Pending Drafts</p>
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

// ── Filter chip ───────────────────────────────────────────────────────────────

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-block', padding: '4px 12px', borderRadius: 16, fontSize: 12,
        fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap',
        background: active ? '#0F2D6B' : '#fff',
        color: active ? '#fff' : '#374151',
        border: `1px solid ${active ? '#0F2D6B' : '#D1D5DB'}`,
      }}
    >
      {children}
    </Link>
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
    <span style={{ ...style, display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
      {format ?? 'unknown'}
    </span>
  );
}

// ── Provider badge ────────────────────────────────────────────────────────────

function ProviderBadge({ provider }: { provider: string | null }) {
  if (!provider) return null;
  const style = provider === 'gemini'
    ? { bg: '#DCFCE7', color: '#166534' }
    : { bg: '#FEF3C7', color: '#92400E' };
  return (
    <span style={{ background: style.bg, color: style.color, display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em' }}>
      {provider.toUpperCase()}
    </span>
  );
}

// ── Draft card ────────────────────────────────────────────────────────────────

function DraftCard({ draft, filters, redirectTo }: { draft: any; filters: Filters; redirectTo: string }) {
  const title             = draft.draft_title || draft.source_title || '(no title)';
  const awaitingGeneration = draft.status === 'approved' && !draft.draft_body;
  const preview           = draft.source_excerpt ? draft.source_excerpt.slice(0, 300) : null;
  const pubDate = draft.source_published_at
    ? new Date(draft.source_published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;
  const domain  = extractDomain(draft.source_url);
  const isDraft = draft.status === 'draft';

  return (
    <div style={{ background: '#fff', border: '1px solid #E4E7EB', borderRadius: 12, padding: '20px 24px', marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <FormatBadge format={draft.draft_format} />
            <span style={{ fontSize: 11, color: '#9CA3AF', background: '#F3F4F6', padding: '1px 6px', borderRadius: 8 }}>{domain}</span>
            {pubDate && <span style={{ fontSize: 12, color: '#9CA3AF' }}>{pubDate}</span>}
            {draft.status !== 'draft' && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 12, background: draft.status === 'approved' ? '#DCFCE7' : '#FEE2E2', color: draft.status === 'approved' ? '#166534' : '#991B1B', textTransform: 'uppercase' }}>
                {draft.status}
              </span>
            )}
            {awaitingGeneration && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 12, background: '#FEF9C3', color: '#854D0E', textTransform: 'uppercase' }}>
                Awaiting Generation
              </span>
            )}
            <ProviderBadge provider={draft.provider} />
            {draft.requires_manual_approval && (
              <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 12, background: '#FEF3C7', color: '#92400E', textTransform: 'uppercase', border: '1px solid #F59E0B' }}>
                Manual Review Required
              </span>
            )}
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#1F2937', margin: 0, lineHeight: 1.4 }}>{title}</h2>
        </div>
      </div>

      <a href={draft.source_url} target="_blank" rel="noopener noreferrer"
        style={{ fontSize: 12, color: '#006CB7', wordBreak: 'break-all', display: 'block', marginBottom: 10 }}>
        {draft.source_url}
      </a>

      {awaitingGeneration ? (
        <p style={{ fontSize: 13, color: '#92400E', margin: '0 0 16px', background: '#FFFBEB', padding: '10px 12px', borderRadius: 8, borderLeft: '3px solid #FCD34D' }}>
          Body not yet generated — run RADAR-04 (generate-drafts.js) or wait for the next nightly cron tick.
        </p>
      ) : draft.draft_body ? (
        <DraftBodyExpander body={draft.draft_body} />
      ) : preview ? (
        <p style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6, margin: '0 0 16px', background: '#F9FAFB', padding: '10px 12px', borderRadius: 8, borderLeft: '3px solid #E4E7EB' }}>
          {preview}{preview.length >= 300 && ' …'}
        </p>
      ) : null}

      {/* STATE: draft + no body → signal review (Approve / Reject only) */}
      {isDraft && !draft.draft_body && (
        <div style={{ display: 'flex', gap: 8 }}>
          <form action={approveDraft} style={{ margin: 0 }}>
            <input type="hidden" name="id" value={draft.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <button type="submit" style={{ padding: '7px 18px', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              ✓ Approve signal
            </button>
          </form>
          <form action={rejectDraft} style={{ margin: 0 }}>
            <input type="hidden" name="id" value={draft.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <button type="submit" style={{ padding: '7px 18px', background: '#fff', color: '#DC2626', border: '2px solid #DC2626', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              ✗ Reject
            </button>
          </form>
        </div>
      )}

      {/* STATE: draft + body → article review (Approve / Reject with body visible) */}
      {isDraft && draft.draft_body && (
        <div style={{ display: 'flex', gap: 8 }}>
          <form action={approveDraft} style={{ margin: 0 }}>
            <input type="hidden" name="id" value={draft.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <button type="submit" style={{ padding: '7px 18px', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              ✓ Approve article
            </button>
          </form>
          <form action={rejectDraft} style={{ margin: 0 }}>
            <input type="hidden" name="id" value={draft.id} />
            <input type="hidden" name="redirectTo" value={redirectTo} />
            <button type="submit" style={{ padding: '7px 18px', background: '#fff', color: '#DC2626', border: '2px solid #DC2626', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
              ✗ Reject
            </button>
          </form>
        </div>
      )}

      {/* STATE: approved + no body → Generate Article */}
      {draft.status === 'approved' && !draft.draft_body && (
        <form action={generateArticle} style={{ margin: 0 }}>
          <input type="hidden" name="id" value={draft.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button type="submit" style={{ padding: '7px 18px', background: '#F7A800', color: '#0F2D6B', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ✦ Generate Article
          </button>
        </form>
      )}

      {/* STATE: approved + body → Publish */}
      {draft.status === 'approved' && draft.draft_body && (
        <form action={publishDraft} style={{ margin: 0 }}>
          <input type="hidden" name="id" value={draft.id} />
          <input type="hidden" name="redirectTo" value={redirectTo} />
          <button type="submit" style={{ padding: '7px 18px', background: '#006CB7', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            ↑ Publish
          </button>
        </form>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: { status?: string; format?: string; domain?: string; genError?: string; genDraftId?: string };
}

export default async function AdminPendingPage({ searchParams }: Props) {
  if (!isAuthed()) return <LoginPage />;

  const genError    = searchParams.genError ? decodeURIComponent(searchParams.genError) : null;
  const statusFilter = searchParams.status || 'draft';
  const formatFilter = searchParams.format || '';
  const domainFilter = searchParams.domain || '';
  const filters: Filters = { status: statusFilter, format: formatFilter || undefined, domain: domainFilter || undefined };
  // Current URL preserved for redirects after actions — keeps filter state intact
  const redirectTo = buildUrl(filters, {});

  const supabase = createServerClient();

  // ── Main query ──
  let q = supabase
    .from('pending_drafts')
    .select('id, source_url, source_title, source_excerpt, source_published_at, draft_title, draft_body, draft_format, status, created_at, provider, requires_manual_approval')
    .eq('status', statusFilter)
    .is('iteration_label', null)
    .order('created_at', { ascending: false });

  if (formatFilter) q = q.eq('draft_format', formatFilter);
  if (domainFilter) q = q.ilike('source_url', `%${domainFilter}%`);

  const { data: drafts, error } = await q;
  const draftsToShow = drafts ?? [];

  // ── Domain chips — query source_url for current status+format (no domain filter) ──
  let domainQ = supabase
    .from('pending_drafts')
    .select('source_url')
    .eq('status', statusFilter)
    .is('iteration_label', null);
  if (formatFilter) domainQ = domainQ.eq('draft_format', formatFilter);
  const { data: allUrls } = await domainQ;

  const domainCounts: Record<string, number> = {};
  for (const row of allUrls ?? []) {
    const d = extractDomain(row.source_url);
    domainCounts[d] = (domainCounts[d] ?? 0) + 1;
  }
  const domains = Object.entries(domainCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([d]) => d);

  return (
    <div style={{ minHeight: '100vh', background: '#F7F8FA' }}>
      {/* Header */}
      <div style={{ background: '#0F2D6B', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontFamily: 'var(--font-fredoka)', fontSize: 20, fontWeight: 700, color: '#F7A800' }}>BOI Admin</span>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', marginLeft: 12 }}>Pending Drafts</span>
        </div>
        <form action={logout} style={{ margin: 0 }}>
          <button type="submit" style={{ padding: '6px 14px', background: 'transparent', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            Log out
          </button>
        </form>
      </div>

      <div style={{ maxWidth: 860, margin: '0 auto', padding: '20px 16px' }}>

        {/* ── Generation error banner ── */}
        {genError && (
          <div style={{ background: '#FEE2E2', border: '2px solid #DC2626', borderRadius: 10, padding: '14px 18px', marginBottom: 16 }}>
            <p style={{ margin: 0, fontWeight: 700, color: '#991B1B', fontSize: 13 }}>Generation failed:</p>
            <pre style={{ margin: '6px 0 0', color: '#7F1D1D', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace' }}>{genError}</pre>
          </div>
        )}

        {/* ── Filter bar ── */}
        <div style={{ background: '#fff', border: '1px solid #E4E7EB', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>

          {/* Status */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Status</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['draft', 'approved', 'rejected'].map(s => (
                <Chip key={s} href={buildUrl(filters, { status: s, format: formatFilter || undefined, domain: domainFilter || undefined })} active={statusFilter === s}>
                  {s}
                </Chip>
              ))}
            </div>
          </div>

          {/* Format */}
          <div style={{ marginBottom: domains.length > 0 ? 10 : 0 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Format</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <Chip href={buildUrl(filters, { format: undefined })} active={!formatFilter}>All</Chip>
              {['news', 'review', 'opinion'].map(f => (
                <Chip key={f} href={buildUrl(filters, { format: formatFilter === f ? undefined : f })} active={formatFilter === f}>
                  {f}
                </Chip>
              ))}
            </div>
          </div>

          {/* Domain */}
          {domains.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Source</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <Chip href={buildUrl(filters, { domain: undefined })} active={!domainFilter}>All</Chip>
                {domains.map(d => (
                  <Chip key={d} href={buildUrl(filters, { domain: domainFilter === d ? undefined : d })} active={domainFilter === d}>
                    {d}
                  </Chip>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Results bar ── */}
        {(() => {
          const awaitingCount = statusFilter === 'approved'
            ? draftsToShow.filter((d: any) => !d.draft_body).length
            : 0;
          const readyCount = statusFilter === 'approved'
            ? draftsToShow.filter((d: any) => !!d.draft_body).length
            : 0;
          return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <p style={{ fontSize: 14, color: '#6B7280', margin: 0 }}>
                {error ? `Error: ${error.message}` : `${draftsToShow.length} ${statusFilter} draft${draftsToShow.length !== 1 ? 's' : ''}`}
                {awaitingCount > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#92400E' }}>({awaitingCount} awaiting generation)</span>
                )}
                {readyCount > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 12, color: '#16A34A' }}>({readyCount} ready to publish)</span>
                )}
              </p>
              {statusFilter === 'draft' && draftsToShow.length > 0 && (
                <form action={approveAll} style={{ margin: 0 }}>
                  {formatFilter && <input type="hidden" name="format" value={formatFilter} />}
                  {domainFilter && <input type="hidden" name="domain" value={domainFilter} />}
                  <input type="hidden" name="redirectTo" value={redirectTo} />
                  <button type="submit" style={{ padding: '7px 16px', background: '#0F2D6B', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ✓ Approve all {draftsToShow.length}
                  </button>
                </form>
              )}
              {statusFilter === 'approved' && (readyCount > 0 || awaitingCount > 0) && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {readyCount > 0 && <PublishAllButton count={readyCount} />}
                  {awaitingCount > 0 && <GenerateBatchButton count={awaitingCount} />}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── Draft list ── */}
        {draftsToShow.length === 0 && !error ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF', fontSize: 14 }}>
            {statusFilter === 'draft' ? 'No drafts pending. Check back after the next radar run.' : `No ${statusFilter} drafts.`}
          </div>
        ) : (
          draftsToShow.map((draft: any) => <DraftCard key={draft.id} draft={draft} filters={filters} redirectTo={redirectTo} />)
        )}
      </div>
    </div>
  );
}
