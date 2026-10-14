// #422 (P9 item 5, approved by Abhinav 28 Sep 2026): same-set repeat guard.
//
// Runs in generate-approved-drafts.ts at generation, BEFORE drafting (no model
// tokens spent on a repeat). A news draft whose primary subject is a catalogue
// set that already has a news article published in the last
// SAME_SET_WINDOW_DAYS days, or earlier in the same run, is held for review
// (status='draft', discard_reason 'held_same_set: ...') instead of generated.
// Nothing is deleted.
//
// Incident: the 40900 Scary Haunted Tree GWP reveal was published on 22 Sep
// (Jay's Brick Blog source) and again on 28 Sep (Brickset source), in two
// separate runs with no check between them.
//
// Subject = set numbers in the source URL and the source/draft title only. The
// excerpt is deliberately not scanned: roundups ("What's hot this week") list
// many sets and would be held whenever any of them had recent news.
// Candidates must exist in `sets`, so years and prices never match.
//
// Release: when a human re-approves a held draft in /admin/pending
// (approved_by='admin' while discard_reason still carries the hold), the
// guard steps aside and the draft generates normally.
//
// Failure behaviour (G14): if the recent-articles or catalogue lookup errors,
// the guard returns no hit and generation continues as it did before #422.
// The error is logged. The guard never blocks on its own failure.

export const SAME_SET_WINDOW_DAYS = 7;
export const HOLD_PREFIX = 'held_same_set';

export interface GuardDraft {
  source_url: string;
  source_title: string | null;
  draft_title?: string | null;
  draft_format?: string | null;
  approved_by?: string | null;
  discard_reason?: string | null;
}

export interface RecentArticle {
  slug: string;
  title: string;
  published_at: string;
  set_number?: string | null;
}

export interface SameSetHit {
  set_number: string;
  path: string;
  published_at: string;
  sameRun: boolean;
}

/** Set-number-shaped tokens naming the draft's subject (URL + titles). Unvalidated. */
export function subjectCandidates(d: GuardDraft): string[] {
  const out = new Set<string>();
  const url = d.source_url.match(/\/(?:sets?|products?)\/(\d{4,7})(?:[-/]|$)/i);
  if (url) out.add(url[1]);
  const slugged = d.source_url.match(/(?:^|[/-])(\d{4,7})(?=-[a-z])/i);
  if (slugged) out.add(slugged[1]);
  for (const t of [d.source_title, d.draft_title]) {
    for (const m of (t ?? '').matchAll(/(?<![\d₹$£€.,])(\d{4,7})(?:-\d+)?(?![\d.,%])/g)) out.add(m[1]);
  }
  // Four-digit years ("Top sets of 2026") are never a subject, even if a set shares the number.
  return [...out].filter(n => !(n.length === 4 && +n >= 1949 && +n <= 2035));
}

/** True if a slug or title names this set number as a whole token. */
export function mentionsSet(text: string, setNumber: string): boolean {
  return new RegExp(`(?:^|[^0-9])${setNumber}(?:$|[^0-9])`).test(text);
}

export function isHumanReleased(d: GuardDraft): boolean {
  return d.approved_by === 'admin' && (d.discard_reason ?? '').startsWith(HOLD_PREFIX);
}

/**
 * Pure decision. `catalogued` = the draft's candidates that exist in `sets`.
 * `recent` = news articles published inside the window. `batch` = set_number to
 * path for articles published earlier in this run.
 */
export function decideSameSet(
  d: GuardDraft,
  catalogued: string[],
  recent: RecentArticle[],
  batch: Map<string, string>,
): SameSetHit | null {
  if ((d.draft_format ?? 'news') !== 'news' || isHumanReleased(d)) return null;
  for (const set of catalogued) {
    const inRun = batch.get(set);
    if (inRun) return { set_number: set, path: inRun, published_at: 'this run', sameRun: true };
    const prior = recent
      .filter(a => a.set_number === set || mentionsSet(a.slug, set) || mentionsSet(a.title, set))
      .sort((a, b) => a.published_at.localeCompare(b.published_at))[0];
    if (prior) return { set_number: set, path: `/news/${prior.slug}`, published_at: prior.published_at, sameRun: false };
  }
  return null;
}

export function holdReason(hit: SameSetHit): string {
  const when = hit.sameRun ? 'earlier in this run' : `published ${hit.published_at.slice(0, 10)}`;
  return `${HOLD_PREFIX}: set ${hit.set_number} already covered by ${hit.path} (${when}); approve again in /admin/pending to publish anyway`;
}

// Minimal structural type for the Supabase client calls used below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = { from: (t: string) => any };

/** One query per run: news articles inside the window. Error → [] (fail open, logged). */
export async function loadRecentNews(sb: Sb, now = new Date()): Promise<RecentArticle[]> {
  const since = new Date(now.getTime() - SAME_SET_WINDOW_DAYS * 864e5).toISOString();
  const { data, error } = await sb.from('news_articles')
    .select('slug, title, published_at, set_number')
    .gte('published_at', since)
    .limit(1000);
  if (error) {
    console.error('[same-set-guard] recent news lookup failed; guard off for this run:', error.message ?? error);
    return [];
  }
  return (data ?? []) as RecentArticle[];
}

/** One query per news draft with candidates. Error → [] (fail open, logged). */
export async function cataloguedCandidates(sb: Sb, d: GuardDraft): Promise<string[]> {
  if ((d.draft_format ?? 'news') !== 'news') return [];
  const cands = subjectCandidates(d);
  if (cands.length === 0) return [];
  const { data, error } = await sb.from('sets').select('set_number').in('set_number', cands);
  if (error) {
    console.error('[same-set-guard] catalogue lookup failed; draft not guarded:', error.message ?? error);
    return [];
  }
  const known = new Set(((data ?? []) as { set_number: string }[]).map(r => r.set_number));
  return cands.filter(c => known.has(c));
}
