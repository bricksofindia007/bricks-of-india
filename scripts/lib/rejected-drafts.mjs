// #525 (Abhinav, 2 Oct 2026): which rejected drafts the 30-day purge may delete.
// Only rows written by the keep-for-30-days path in scripts/generate-approved-drafts.ts: status
// 'rejected', a discard_reason starting with one of its prefixes, and updated_at on/after KEEP_FROM
// (the day the rule shipped). Older rejected rows are never matched (deleting those is a separate
// decision, after the backup restore drill has passed).
export const REJECTED_PREFIXES = ['rejected_by_gates:', 'both_providers_failed:'];
export const KEEP_FROM = '2026-10-04T00:00:00Z';

/** Applies the purge filter to a supabase-js query builder (select or delete). */
export function rejectedDraftsFilter(q, cutoffIso) {
  return q.eq('status', 'rejected')
    .or(REJECTED_PREFIXES.map((p) => `discard_reason.like.${p}*`).join(','))
    .gte('updated_at', KEEP_FROM)
    .lt('updated_at', cutoffIso);
}
