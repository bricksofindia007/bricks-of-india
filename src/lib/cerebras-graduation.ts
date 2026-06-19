import type { SupabaseClient } from '@supabase/supabase-js';

const PROBATION_DAYS     = 30;
const PROBATION_ARTICLES = 50;

export type GraduationStatus = {
  graduated: boolean;
  articleCount: number;
  oldestArticleDaysAgo: number | null;
};

// Checks how many Cerebras-generated articles are published and how long ago the first one was.
// Graduation requires 30 days OR 50 articles to have passed. During probation, auto-publish is
// skipped and requires_manual_approval = true so operator reviews Cerebras output.
export async function getCerebrasGraduationStatus(
  sb: SupabaseClient,
): Promise<GraduationStatus> {
  const { data, error } = await sb
    .from('pending_drafts')
    .select('created_at')
    .eq('provider', 'cerebras')
    .eq('status', 'published');

  if (error || !data || data.length === 0) {
    return { graduated: false, articleCount: 0, oldestArticleDaysAgo: null };
  }

  const articleCount = data.length;
  const oldest       = data.reduce(
    (min: string, r: { created_at: string }) => (r.created_at < min ? r.created_at : min),
    data[0].created_at,
  );
  const daysSince = (Date.now() - new Date(oldest).getTime()) / (1000 * 60 * 60 * 24);
  const graduated = daysSince >= PROBATION_DAYS || articleCount >= PROBATION_ARTICLES;

  return { graduated, articleCount, oldestArticleDaysAgo: Math.floor(daysSince) };
}

export function requiresManualApproval(graduated: boolean): boolean {
  return !graduated;
}
